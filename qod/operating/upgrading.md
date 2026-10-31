---
id: upgrading
title: Upgrading to 0.11.0
description: "The ordered checklist for upgrading a Quack on Demand manager from 0.10.x to 0.11.0, where every authorization decision moves into the DuckDB node."
keywords: ["upgrade", "release notes", "0.11.0", "migration", "breaking changes"]
---

0.11.0 moves every authorization decision into the node: each DuckDB node now runs `qod-node`, QoD's own executable on the official DuckDB library, and judges every statement of a user who is not a superuser on the plan DuckDB bound for it, asking the manager for a verdict. It is not a drop-in upgrade. A manager still carrying a removed setting refuses to boot, every node must restart, and tenant users lose access the old switches used to grant.

Work through the steps in order. The sections after the checklist give the details, and the pages they link to describe the new behavior in full.

## Checklist

**Before upgrading**

1. **Back up the control-plane database.** Liquibase changesets `0047` to `0055` run at boot, and `0055` drops the `qodstate_pool.lockdown` column the previous release reads. The migration is one-way.
2. **Replace the static API key.** Mint personal access tokens for automation (`qod login`, then `qod auth pat create`), point MCP clients and SCIM connectors at them, then remove `QOD_API_KEY` from every environment, chart value and Compose file. A manager with a non-empty `QOD_API_KEY` refuses to boot. See [Static API key](#static-api-key).
3. **Unset the removed authorization switches** everywhere: `QOD_ACL_ENABLED`, `QOD_ACL_FILTERED_METADATA`, `QOD_ACL_DIALECT` and `QOD_NODE_LOCKDOWN` (`qod setup --unset <NAME>` for a value the CLI stored). Boot refuses each of them, set to any value, empty included. Drop the Helm values `security.aclEnabled` and `security.nodeLockdown`: the chart no longer reads them.
4. **Grant tenant users what they read.** Enforcement can no longer be turned off, and per-pool lockdown is gone. A manager that ran with the ACL off must grant its users first (the built-in `qod_all_tables` role, `*.*.* ALL`, is what an omitted `--role` gives a new user). See [Access control model](./rbac-model.md).
5. **On OPA tenants, update the policies** for the node's input: accesses carry `kind`, `columns` and `via`, the statement carries `locations`, and no input carries `statement.text`. Rego that does not handle `via` denies reads through a secure view. See [OPA tenants](#opa-tenants).
6. **If users load files**, set `QOD_TENANT_FILES_ROOT`, and list in `QOD_USER_S3_ALLOWED_ENDPOINTS` any endpoint other than AWS that users' own S3 keys target. See [File access](#file-access).
7. **Set the node callback address.** In fleet mode set `QOD_INTERNAL_URL` on every manager; on Kubernetes without the Helm chart set `QOD_POD_IP` from `status.podIP` (or `QOD_INTERNAL_URL`). Under HA, set `QOD_NODE_KEY_SECRET` to the same value on every replica, or leave it unset on all. See [Nodes](#nodes).

**During the upgrade**

8. **Upgrade every HA replica together.** Scale to one replica or use a `Recreate` rollout: `0055` drops a column the previous release reads, so a rolling upgrade breaks the replicas still on 0.10.x.
9. **Upgrade the `qod` CLI with the manager.** An older `qod serve` always exports `QOD_ACL_ENABLED`, which this manager refuses. In fleet mode, upgrade `qod` on every server too.

**After upgrading**

10. **Restart every node.** Nodes speak node protocol 5 with session handle v3; a node started by an earlier release, or an earlier node image, refuses every handle, stays unhealthy and is never routed to. On Kubernetes pull this release's node image.
11. **Read the boot log.** Review the WARNs about untrusted `initSql` and `sql` federation sources (a superuser re-saves what should stay trusted), and the ERROR lines naming tenants whose sign-in `clientSecretRef` was parked (a superuser restores each one). See [Init SQL and federation](#init-sql-and-federation) and [Per-tenant OIDC](./auth-providers.md#per-tenant-oidc).
12. **Rotate the manager's secrets if tenant admins are not fully trusted.** See [Security: rotate secrets](#security-rotate-secrets).
13. **Tell tenant users what changed for them.** DuckDB's built-in listing views are refused to them (`pg_catalog.*`, `sqlite_master`, bare `SHOW` / `DESCRIBE`, `system.information_schema.*`); they keep `information_schema.*`, `SHOW TABLES` and `duckdb_*()`, filtered to their grants. Loading their own files now starts with `qod profile s3 add`. See [What tenant users lose](#what-tenant-users-lose).

## Removed settings

| Removed | What the manager does now | Replacement |
|---|---|---|
| `QOD_API_KEY` / `quack-on-demand.apiKey` | Refuses to boot on a non-empty value (an empty one passes) | A `qod login` session, or a PAT in `QOD_TOKEN` |
| `QOD_ACL_ENABLED` / `quack-flightsql.acl.enabled` | Refuses to boot while set | None: every node enforces, always |
| `QOD_ACL_FILTERED_METADATA` / `quack-flightsql.acl.filteredMetadata` | Refuses to boot while set | None: listings are always filtered to the user's grants |
| `QOD_ACL_DIALECT` / `quack-flightsql.acl.dialect` | Refuses to boot while set | None |
| `QOD_NODE_LOCKDOWN` / `quack-flightsql.nodeLockdown` | Refuses to boot while set | None: the node refuses `ATTACH`, secrets and file access by path to every non-superuser |
| Per-pool lockdown (`POST /api/pool/setLockdown`, `qod pool set-lockdown`, `qod pool create --lockdown`, MCP `set_pool_lockdown`, the manifest pool field) | The endpoint and commands are gone; the manifest field and the `lockdown` field of `pool/create` are ignored | None |
| Helm `apiKey.*` | The chart fails on an `apiKey` value | `admin.password` or `admin.existingSecret` (now required) |
| Helm `security.aclEnabled`, `security.nodeLockdown` | No longer read | None |

The startup banner's SQL ACL line now always reads `ENFORCED on every node (QoD grants, or the tenant's OPA in opa mode)`, and the NODE LOCKDOWN line is gone.

## Static API key

Every REST, MCP and SCIM caller is now a session or a personal access token, and every admin action is attributed to a user:

- an operator's CLI or curl: a `qod login` session, or a PAT in `QOD_TOKEN`, sent as `X-API-Key` (the header keeps its name);
- CI and IaC: a PAT an admin mints once (`qod auth pat create`), or `qod login --password-stdin` inside the job;
- MCP clients: a PAT as `Authorization: Bearer`, the only credential `/mcp` admits;
- SCIM connectors: a tenant-admin PAT as `Authorization: Bearer`;
- recovery: `qod admin reset-password`, which now also re-enables a disabled superuser when `--username` names it.

`qod start` and `qod serve` refuse to launch while `QOD_API_KEY` is set in the shell or stored in the profile's `[start]` table, and `qod setup` no longer has `--api-key`. Boot also refuses when nothing could create a session (no password backend and no system-scope OIDC sign-in), and when the FlightSQL edge and the Quack front door have no authenticator at all: the trust-the-client mode is gone. See [Authentication](./authentication.md).

The session secret no longer needs pinning: with `QOD_SESSION_JWT_SECRET` unset, the first boot generates one and stores it in the control plane (`qodstate_boot_secret`), so sessions survive a restart and every HA replica shares it. Boot prints where it came from, never the value.

## Nodes

- **qod-node replaces the DuckDB CLI** on every backend. A manager that starts nodes on its host uses `QOD_NODE_BIN` when set, else the binary its jar bundles for Linux and macOS; on Windows, `qod start`, `qod serve` and `run-jar.ps1` download it. `qod fleet join` runs the copy the qod wheel bundles, and the Kubernetes node image ships it in `/opt/qod-node`.
- **Every statement carries a session handle** signed with the node's own key, derived from the node-key secret: `QOD_NODE_KEY_SECRET` (at least 32 characters) when set, else one value the first boot generates and stores in the control plane. Changing it, or deleting the stored row, means restarting every node.
- **Nodes call the manager back** for their verdicts, on the URL of the replica that minted the handle: `QOD_INTERNAL_URL`, else `http://<QOD_POD_IP>:<port>`, else the manager's bind address, else `http://127.0.0.1:<port>`. Boot prints it as `node decide URL: <url>` and refuses fleet mode without `QOD_INTERNAL_URL`, and Kubernetes with a loopback URL. With `networkPolicy.enabled`, the chart lets node pods reach the manager pods on TCP 20900. See [Fleet deployment](./deploy-fleet.md) and [Kubernetes deployment](./deploy-kubernetes.md).
- **Extension settings are fixed at node start**: community and unsigned extensions and autoinstall are off. Turn one on with `QOD_NODE_ALLOW_COMMUNITY_EXTENSIONS`, `QOD_NODE_ALLOW_UNSIGNED_EXTENSIONS` or `QOD_NODE_AUTOINSTALL_KNOWN_EXTENSIONS`; install any other extension a statement needs at node start (`INSTALL <name>;` in a database or pool `initSql`).
- **The nodes' own S3 credentials sign only a database's own data path.** A superuser read of another bucket, or a trusted `initSql` or `sql` federation setup that read one with the node's keys, now finds no secret: register your own keys (`qod profile s3 add`) or create a scoped secret.
- **Iceberg tables on S3 are read-only through QoD for every principal**, superusers included, until upstream duckdb-iceberg signs its commits with connection secrets. See [Iceberg](./iceberg.md).
- The spawn scripts refuse a DuckLake or duckdb-file node with no data path instead of defaulting to a developer path.

## What tenant users lose

The node refuses to a user who is not a superuser:

- any function its classification does not list, anywhere in the statement or in a view, macro or stored expression it reaches (`QoD: function <name> is not classified`);
- `CREATE MACRO`, `CREATE` / `DROP SECRET`, `ATTACH`, `IMPORT` / `EXPORT DATABASE`, `current_setting()`, `pg_get_viewdef`, `duckdb_memory()`, `LOAD` of an extension by bare name, and `SET` of the `s3_*`, secret, proxy and HTTP settings;
- DuckDB's unfiltered catalog listings: `pg_catalog.*`, `sqlite_master`, bare `SHOW` and `DESCRIBE`, `SHOW TABLES FROM ...`, `SHOW SCHEMAS`, `SHOW DATABASES`, `SHOW VARIABLES`, `system.information_schema.*`, and `duckdb_constraints()`, `duckdb_indexes()`, `duckdb_sequences()`, `duckdb_triggers()`, `duckdb_types()`, `duckdb_functions()`, `duckdb_dependencies()`;
- a file named in a table position (`FROM 'x.parquet'` is now "table not found": use the reader function), and any file outside the locations below;
- trigger DDL, which tenant admins lose too.

They keep `information_schema.schemata` / `tables` / `columns` / `views`, `duckdb_schemas()` / `duckdb_tables()` / `duckdb_views()` / `duckdb_columns()`, `SHOW TABLES` and `DESCRIBE <table>` of a granted table, all filtered to their grants. Plain views now run with the reader's rights, so the reader needs a grant on what the view reads; secure views, which only superusers create, run with their owner's. A node refusal reads `QoD: <reason>`, is answered FlightSQL `UNAUTHORIZED` (it was `INVALID_ARGUMENT`), and is recorded with history status `denied`. `QoD: authorization unavailable, retry` means no verdict could be had in time, and a single statement can be retried.

Read-only federated catalogs now refuse writes, DDL, `ATTACH` and `DETACH` to superusers too. See [Access control model](./rbac-model.md) and [Federation](./federation.md).

## File access

A tenant user reads or writes a file by path only through a file reader or `COPY`, and only:

- under an `s3://` scope they registered keys of their own for (`qod profile s3 add <scope>`), signed with those keys only; an endpoint other than AWS must be listed in `QOD_USER_S3_ALLOWED_ENDPOINTS`;
- or under a local folder the tenant authorized (`qod tenant location add <tenant> <folder>`), which must sit under `<QOD_TENANT_FILES_ROOT>/<tenant id>/`. With `QOD_TENANT_FILES_ROOT` unset, the default, no local folder is authorized.

A database's data folder is never reachable by its path. Keep tenant folders free of symbolic links: a link inside an authorized folder can lead out of it through a glob or a partitioned `COPY`. Users' keys are stored in plaintext in the control-plane database, so protect its backups and replicas accordingly.

## OPA tenants

The `statement` rule is now asked only by the node, with the accesses' new `kind`, `columns` and `via` and the statement's `locations`. The gateway's parser-extracted input is no longer sent, no input carries `statement.text`, and `--send-statement-text` has no effect. `qod tenant opa-test --sql` now runs the statement through a node of a running pool, as the named tenant user, and returns the input the node would send OPA. OPA transport errors are no longer shown to tenants: they read "OPA unreachable or returned an error (see the manager log)", and the cause is in the manager's WARN line.

## Init SQL and federation

- A database's or pool's `initSql` written by a tenant admin now runs under an allowlist: `SET` / `RESET` of a few resource and session-default settings to a literal, read-only PRAGMAs, and `INSTALL` / `LOAD` of listed extensions by bare name; every other statement is skipped. One written by a superuser, `qod serve`, a manifest import or a branch runs as written. Changeset `0053` marks every existing non-empty `initSql` not written by `qod serve` untrusted, and boot WARNs once per database or pool that would lose statements: a superuser re-saving the text unchanged (`qod database update --init-sql ...`, `qod pool set-init-sql ...`) trusts it again. Restart the nodes after that. See [Tenants and databases](./tenants-databases.md).
- Federated sources of type `sql` are superuser-only. Existing ones keep running, and boot WARNs once per one whose author is unknown. Every `{{secret.NAME}}` in a `sql` template must sit inside a plain single-quoted literal: quote the placeholders of the templates boot lists, and save them again as a superuser. See [Federation](./federation.md).

## Security: rotate secrets

A manager where tenant admins are not fully trusted, and where tenants could set their own sign-in configuration, should upgrade promptly and then rotate every secret held in the manager's environment: in particular `QOD_SESSION_JWT_SECRET` (which also ends every open session), `QOD_PG_PASSWORD` and the cloud credentials. `QOD_API_KEY` is not rotated but unset. Also review the personal access tokens owned by superuser rows, and the recent superuser sign-ins in the [audit log](../administration/audit-log.md).

Tenant sign-in now stays inside the tenant, and secret references saved before 0.11.0 are parked until a superuser restores them. The details, with the steps for an `identitySource=db` manager that serves tenant SSO, are on [Authentication providers](./auth-providers.md) and [Authentication](./authentication.md).

## Control-plane changesets

| Changeset | Change |
|---|---|
| `0047-node-authz-key-secret` | `qodstate_node_authz`: the generated node-key secret, when `QOD_NODE_KEY_SECRET` is unset |
| `0048-tenant-auth-client-secret` | `qodstate_tenant.auth_client_secret`; parks each tenant's `clientSecretRef` as `clientSecretRefUnconfirmed` |
| `0049-boot-secret` | `qodstate_boot_secret`: the generated session secret |
| `0050-policy-version` | `qodstate_tenant.policy_version`, which drops nodes' cached verdicts when grants change |
| `0051-tenant-location` | `qodstate_tenant_location`: tenants' authorized local folders |
| `0052-user-s3-credential` | `qodstate_user_s3_credential`: users' own S3 keys |
| `0053-init-sql-trust` | `init_sql_trusted` on databases and pools, `setup_sql_trusted` on federated sources; marks existing non-empty `initSql` untrusted unless `qod serve` wrote it |
| `0054-data-path-policy-version` | Triggers that bump every tenant's policy version when a database's data path or a managed prefix changes |
| `0055-drop-pool-lockdown` | Drops `qodstate_pool.lockdown` (one-way) |
