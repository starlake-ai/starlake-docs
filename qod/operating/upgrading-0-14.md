---
id: upgrading-0-14
title: Upgrading to 0.14
description: "The checklists for upgrading a QoD manager from 0.13.x to 0.14.0 (restart every node; the manager now checks the upgrade path at boot), from 0.14.0 to 0.14.1 (a disabled tenant is now fully inert) and from 0.14.1 to 0.14.2 (one way: back up first; names match as DuckDB binds them; fleet servers hold no storage keys)."
keywords: ["upgrade", "release notes", "0.14.0", "0.14.1", "0.14.2", "0.13.1", "release gate", "migration", "rollback", "disabled tenant", "staff", "non-ascii names", "fleet storage keys"]
---

Coming from 0.12.x or earlier, first apply [Upgrading to 0.13](./upgrading-0-13.md).

## From 0.13.0 to 0.13.1

1. **Check the maintenance timeout.** `QOD_MAINT_RUN_TIMEOUT_MIN` now caps a maintenance run's whole chain, from its start, the wait for its database's lock included, and the replica running it stops its node when the cap is reached, on a single manager too. Before, it only bounded the time between two steps. Its default rises from 60 to 240 minutes. Set it above the longest full maintenance chain of your largest database.
2. **Clear a `defaultDatabase` that names another catalog.** A database's `defaultDatabase` may only name the database's own catalog (its `catalogAlias`, else its `dbName`, else its name; `memory` for `kind=memory`), where its nodes resolve unqualified table names. `database/create` and `database/update` refuse any other value with `400 default_database_mismatch`. A database stored with another value keeps working: the value is ignored, a manifest export leaves it out, and each boot prints one `WARN:` line for it. Clear it with `qod database update --default-database ''`. A `memory` database that pointed `defaultDatabase` at a federated alias names that catalog's tables by their alias (`fedpg.public.orders`).
3. **Under HA**, during a rolling upgrade a maintenance run still executing on a replica of 0.13.0 can be failed as `stale` by an upgraded leader. No node is stopped for it, and the next cadence or threshold tick queues the run again.

## From 0.13.x to 0.14.0

0.14.0 upgrades directly from 0.10.0 or later, and rolls back to 0.13.1 without a restore of the control-plane database.

### Checklist

**While upgrading**

1. **Upgrade the node image and the fleet servers with the manager.**

**After upgrading**

2. **Restart every node.** Until a node restarts, each real authorization outage on it reads as a permanent denial instead of a retryable `UNAVAILABLE`. See [Authorization outages](#authorization-outages).
3. **Tell users of row and column policies what changed for them.** See [What changes for clients](#what-changes-for-clients).

### The release gate

From 0.14.0, each release states its upgrade path, and the manager checks it at boot. The release notes open with an *Upgrading* block, and the release's `release.json` carries the same fields:

- `min_from_version`: the oldest release that upgrades directly to this one, applying the steps of every release after it, in order.
- The manual steps of every release after it, each marked before, during or after the upgrade.
- `rollback_without_restore`: whether the previous release boots on the schema this one leaves, and if not, what makes the rollback one way.

Liquibase changeset `0059` adds the `qodstate_release` table, where each manager records its release once the schema is applied. At boot, a manager refuses a control plane last run by a release older than its `min_from_version`, naming the release to go through first, and refuses a schema that a newer release changed one way, naming the changesets it does not know and the restore to run. Only releases from 0.14.0 on check: 0.13.x booted on a newer schema fails as before.

### Authorization outages

A node's refusal can quote text from the statement after `QoD: `, so a statement could once be refused with a message that read like an outage (`authorization unavailable, retry`) and escape the denial audit. A 0.14.0 node now ends a real outage with a marker bound to the statement's session handle and the node's key, and the manager treats the text as an outage only when that marker verifies. Anything else is a denial: Flight `UNAUTHORIZED`, history status `denied` and a `data-denial` audit event.

A node of an earlier release sends no marker, which is why every node must restart.

Two refusals that were retryable outages are now denials:

- An authorization request larger than the verdict listener takes (1 MiB).
- A request the verdict listener refuses as malformed (`400`).

See [Day-2 operations](../administration/day-2-operations.md) for the errors a client can see.

### What changes for clients

- **Stopping the manager lets its running statements finish.** `qod stop`, Ctrl-C or SIGTERM signal the manager alone. Its FlightSQL edge refuses new calls, lets running ones finish for up to `QOD_DRAIN_TIMEOUT_SEC` (60 s), then the manager stops its nodes, so a stop can take up to the drain plus 20 s. The native Quack front door (`:9494`) still closes its sessions when the drain starts. Under systemd, see `TimeoutStopSec` in [Deploy on a single server](./deploy-single-server.md#03-run-the-manager-under-systemd).
- **Row policies and time travel.** A user with a row policy on a table now reads it at the snapshot its `AT (...)` clause names, filtered. Before, the clause was dropped and the statement read the current snapshot with no error. A time-travel read under a column or row policy is refused when the table, under that name, has not always been the same table with the same column names.
- **Row policies and samples or pivots.** The same user is refused `TABLESAMPLE`, `USING SAMPLE`, or a `PIVOT` / `UNPIVOT` written after the table, which used to return every filtered row unsampled. Wrap the table in a subquery: `FROM (SELECT * FROM customer) USING SAMPLE 10%`. Users without row policies are not affected. See [Access control model](./rbac-model.md).
- **Personal access tokens.** Minting a token whose `tools` list names a tool that does not exist answers `400 unknown_tool`. Tokens already minted are not checked again. `qod auth pat tools` lists the valid names.
- **REST paths.** A request path holding a `.` or `..` segment answers `404` on every API route.
- **Error text.** A client's error no longer names a node's address; the manager log keeps it.

### New in 0.14.0

- A read-only REST data edge serves tables and views as HTTP resources, off by default: see [REST data edge](../connecting/rest-data-edge.md).
- One Linux host can keep several releases installed and switch between them offline: see [Deploy on a single server](./deploy-single-server.md).
- The Docker images check the sha256 of every DuckDB archive they download.

## From 0.14.0 to 0.14.1

0.14.1 upgrades directly from 0.10.0 or later, and rolls back to 0.14.0 without a restore of the control-plane database. Coming from 0.13.x, apply the 0.14.0 checklist above first.

### Checklist

**Before upgrading**

1. **Enable every disabled tenant still in use.** From 0.14.1 a disabled tenant is fully inert, and at the first boot its nodes stop. See [Disabled tenants](#disabled-tenants).
2. **Narrow an upgrade agent's sudo rule.** If an agent runs `deploy/host/install.sh` through sudo with a rule that allows any argument, narrow the rule to the version argument (the repository's [`deploy/host/README.md`](https://github.com/starlake-ai/qod/tree/main/deploy/host), "An upgrade agent"). `install.sh` now takes `--wheel FILE`, which chooses code that runs as root.

### Disabled tenants

Before 0.14.1, disabling a tenant only refused its new FlightSQL and native Quack connections. Now, while a tenant is disabled:

- its open FlightSQL and native Quack sessions are refused on their next statement;
- its users' password and SSO logins answer `403 tenant_disabled`, their console sessions are refused everything but signing out, and their personal access tokens are refused on REST, MCP, SCIM and the REST data edge;
- its pools' nodes are stopped and none starts: a pool create or scale-up answers `409 tenant_disabled`, a resume or node restart fails, a maintenance run due meanwhile fails with that reason, and the pool list says why in each pool's `statusDetail`;
- superusers keep full access to it.

Enabling it brings every pool back with its own settings. Nothing is deleted. Only a superuser disables or enables a tenant: a tenant admin's attempt answers `403 superuser_required`, and the console's toggle is greyed out for them.

### What changes for operators

- **Deleting a tenant deletes its users.** Before, `tenant/delete` left the tenant's users in the control plane, with their tokens and S3 credentials, and a tenant created again under the same name got them back. Creating a tenant now first removes users an earlier delete left under its name, which also clears what a delete on an earlier release left behind.
- **Deletes ask for the name.** On a terminal, `qod tenant delete` and `qod database delete` list what goes with the delete and send nothing until the name is typed back. Without a terminal (a script, an agent, CI) they ask nothing, and no flag skips the question on a terminal. The console's two deletes open a dialog whose **Delete** button stays off until the name is typed. The REST API and the MCP tools are unchanged.

### New in 0.14.1

- `QOD_TENANT_DELETE_ENABLED=false` turns tenant deletion off for everyone, superusers included (`403 tenant_delete_disabled`): see [Tenants and databases](./tenants-databases.md#list-disable-change-auth-delete).
- `deploy/host/install.sh VERSION --wheel FILE [--sha256 HEX]` installs a wheel the caller already checked: see [Deploy on a single server](./deploy-single-server.md).

## From 0.14.1 to 0.14.2

0.14.2 upgrades directly from 0.10.0 or later. **It is one way**: rolling back needs a restore of the control-plane database backup taken before the upgrade, because an older manager reads every staff user as a superuser, with full data access. Liquibase changeset `0061-platform-roles` raises the release gate's schema floor, so an older release with the gate refuses to boot on the upgraded control plane. Coming from 0.13.x, apply the 0.14.0 checklist above first.

### Checklist

The queries below run against the control-plane database (`qod` by default).

**Before upgrading**

1. **Back up the control-plane database.** It is the only way back once staff users exist.
2. **Check `QOD_ADMIN_KIND`.** Unset it (and `quack-on-demand.admin.kind`) or set it to `admin`: any other value now refuses boot, naming the setting. The seeded accounts have no tenant, and only kind `admin` makes a tenant-less account a superuser.
3. **Find tenant-less accounts that are not `admin`.** Such an account (one seeded with `QOD_ADMIN_KIND=user`, one created with `qod user create --superuser` on an earlier release, which sent kind `user`, or a superuser demoted earlier) loses data access with this release, and its refusal reads like an unknown user. Set the kind of each one that should stay a superuser back to `admin`:

   ```sql
   SELECT username, kind FROM qodstate_user WHERE tenant IS NULL AND lower(kind) <> 'admin';
   ```

4. **Check that no tenant user has the kind `staff`**, which changeset `0061` refuses (a kind was free text before 0.11.0). This must return nothing; change the kind of any row it lists first (`qod user update --kind user`):

   ```sql
   SELECT tenant, username, kind FROM qodstate_user WHERE tenant IS NOT NULL AND lower(kind) = 'staff';
   ```

5. **Check grants and policies whose names hold a non-ASCII letter.** Names now match as DuckDB binds them (see [Names with non-ASCII letters](#names-with-non-ascii-letters)). From the first boot, a column policy or row policy spelled with another case of such a letter than its object (`"CLÉS"` for the table `"Clés"`) no longer masks, denies or filters: it fails open. A grant so spelled no longer grants: it fails closed. This query lists every row whose names hold a non-ASCII character, correctly spelled ones too; respell each one that does not name its object exactly as stored, ASCII case aside:

   ```sql
   SELECT kind, tenant_id, role, catalog_name, schema_name, table_name, column_name FROM (
     SELECT 'grant' AS kind, r.tenant_id, r.name AS role, p.catalog_name, p.schema_name, p.table_name,
            NULL AS column_name
       FROM qodstate_role_permission p JOIN qodstate_role r ON r.id = p.role_id
     UNION ALL
     SELECT 'column policy', r.tenant_id, r.name, c.catalog_name, c.schema_name, c.table_name,
            c.column_name
       FROM qodstate_role_column_policy c JOIN qodstate_role r ON r.id = c.role_id
     UNION ALL
     SELECT 'row policy', r.tenant_id, r.name, w.catalog_name, w.schema_name, w.table_name, NULL
       FROM qodstate_role_row_policy w JOIN qodstate_role r ON r.id = w.role_id
   ) AS rows
   WHERE octet_length(concat(catalog_name, schema_name, table_name, column_name))
      <> char_length(concat(catalog_name, schema_name, table_name, column_name))
   ORDER BY tenant_id, role, kind;
   ```

6. **Update OPA policies that compare such names.** An OPA tenant's input now carries catalog, schema, table, column and secure view names folded as DuckDB folds them (`"SECRET_ÉTÉ"` arrives as `secret_ÉtÉ`, formerly `secret_été`). A deny rule written against the old lowercased form stops matching, and so allows.
7. **Local runtime: review pools that set `cpu` or `memory`.** Their nodes now get them as DuckDB `threads` and `memory_limit`, from each node's next start, instead of every core and DuckDB's default of 80% of the host's memory, so they can become much smaller. Clear the ones that should keep the host's size (`qod pool set-resources --cpu '' --memory ''`) or set the size they should have. A `SET threads` or `SET memory_limit` in the database's or pool's `initSql` still wins. See [Pools and cohorts](./pools-cohorts.md#node-sizing-cpu-and-memory).

   ```sql
   SELECT tenant_db_id, name, cpu, memory FROM qodstate_pool WHERE cpu <> '' OR memory <> '';
   ```

8. **Check third-party manager modules.** A module whose public path prefix is empty or not absolute, holds an empty, `.` or `..` segment or one outside `[A-Za-z0-9._-]`, is `/api` itself or one segment under it, lies under a core API segment or another module's name, or, outside `/api`, under none of its own static mounts, now refuses boot, naming the module.

**While upgrading**

9. **Under HA, finish the rollout before creating staff users.** A replica still on an older release reads every staff user as a superuser.
10. **Fleet: upgrade the servers with the manager**, and give every HA replica the same `QOD_S3_*`. A server on an earlier release does not read the storage keys the manager now sends, and a server of this release takes none from an earlier manager. Set `QOD_FLEET_NODE_S3_ENDPOINT` on the manager where servers reach the store at another address than the manager. See [Fleet servers hold no storage keys](#fleet-servers-hold-no-storage-keys).

**After upgrading**

11. **Remove `QOD_S3_*`, `QOD_AZURE_*` and `QOD_GCS_*` from every fleet server.** `qod fleet join` now ignores them and prints one WARN at start naming any it still holds, never their values.
12. **Restart every node**, so the proxy credential fix and the local pool sizes apply.

### Names with non-ASCII letters

DuckDB folds identifier case for the ASCII letters `A` to `Z` only, so `"Clés"` and `"clÉs"` are two tables one schema can hold. The manager folded every cased letter, so a name holding a non-ASCII letter could be matched to the wrong object: a holder of column or row policies could read a masked column unmasked, and a grant could cover a second table spelled with another case. Grants, column and row policies, CTE scoping and the metadata filter now compare names as DuckDB does. ASCII names behave exactly as before. After the upgrade, boot prints one stderr line per stored row whose names hold a non-ASCII letter with another case: `WARN: tenant '...' role '...': the grant | column policy | row policy on ... names a non-ASCII letter that has another case`. See [Access control model](./rbac-model.md#wildcards).

### Fleet servers hold no storage keys

A node whose database has no store of its own reads the manager's default data path with the manager's own keys, which the manager now sends in the node's assignment, as a Kubernetes pod gets them in its Secret. Before, every fleet server needed the manager's `QOD_S3_*` in its own environment, or the first Parquet read failed with HTTP 403 while `count(*)` still answered from catalog statistics. The keys are not stored in the control plane: every HA replica answers from its own environment. A rotated key reaches a node when it next starts. See [Fleet deployment](./deploy-fleet.md#object-store-keys-come-from-the-manager).

### What changes for operators and clients

- **A superuser is a tenant-less account of kind `admin`.** The data plane (FlightSQL, the native front door, MCP, the REST endpoints that run SQL) refuses any other tenant-less account as an unknown user, logging the reason at WARN. A superuser's open session is refused on its next statement once its row is demoted, disabled or deleted. `qod user create --superuser` now creates kind `admin`.
- **Several column policies on one column.** A deny wins, then a policy naming the table wins over a wildcard one, and a column two different masks still cover is refused with `conflicting column policies on <table>.<column>`. Before, the policy applied depended on the order of roles and tables. Give such a column one mask, or a deny. See [Access control model](./rbac-model.md#several-policies-on-one-column).
- **Pool names are unique per tenant.** `pool/create` with a name another database of the tenant already uses answers `409 pool_name_taken`, naming the pool, instead of `500 start_failed`.
- **A node lost mid-statement.** A node that dies while it runs a statement (an OOM kill, a crash) no longer answers `INVALID_ARGUMENT ... header parser received no bytes`: a lone read is retried on another node of the pool, or answers a retryable `UNAVAILABLE`, and any other statement answers that its outcome is unknown.
- **Proxy credentials.** A proxy URL holding a user and password (`HTTPS_PROXY=http://user:password@proxy:3128`) is now split on nodes and in the manager's DuckLake initializer into `http_proxy` and `http_proxy_username` / `http_proxy_password`. Before, DuckDB refused the whole URL at the first HTTP request with an error quoting it, so the password reached whoever ran the statement and every request through the proxy failed.
- **A failed DuckLake pre-init is a boot problem.** When the manager cannot initialize a database's catalog (its Postgres unreachable, an extension that cannot load), boot lists it under PROBLEMS (`catalog NOT initialized by the manager`) and retries every 1 to 15 minutes until it succeeds.
- **Paths of module routes.** Public path prefixes, the core's public paths and the allowlists of non-admin and staff sessions are matched on whole path segments, so an encoded `/` (`%2F`) inside a segment no longer reads as a separator.

### New in 0.14.2

- [Platform staff](./platform-staff.md): tenant-less staff users holding platform roles, bundles of the permissions manager modules declare, and module pages in the admin console.
- One host as containers: `deploy/host/container/` installs the manager and its fleet workers from the one image under systemd. See [Single-server production deployment](./deploy-single-server.md#9-one-host-as-containers).
- One Docker image for every role, signed keyless with cosign, with an SBOM and SLSA provenance. See [Docker deployment](./deploy-docker.md#signed-images).
- `qod healthcheck manager|worker` and `qod fleet join --spill-dir`. See [Fleet deployment](./deploy-fleet.md).
