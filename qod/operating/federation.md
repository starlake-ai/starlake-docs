---
id: federation
title: Federation
description: "Attach Postgres, MySQL, S3 or Iceberg catalogs to a DuckDB gateway database and query them under the same access-control model as native tables."
keywords: ["duckdb federation", "federated query", "iceberg", "postgres", "attach catalog"]
---

Federation attaches external catalogs (Postgres, MySQL, S3/Iceberg, or anything a DuckDB extension can `ATTACH`) to a database under an alias, so clients query remote data through the same FlightSQL session and the same access-control model as native DuckLake tables. Sources are scoped to a tenant-db: each `qodstate_tenant_db` carries its own set of federated sources.

A source is one of two types. A **`sql`** source is the free-form kind this page describes: you write the `ATTACH` yourself. An **`iceberg_rest`** source is typed, declared as fields rather than SQL, and has its own page: see [External Iceberg catalogs](iceberg.md). Everything below about secrets, grants, lifecycle and manifests applies to both.

Provision the tenant and database first (see "Tenants and databases"). The examples below use the [qod CLI](/qod/cli/); they assume `qod login` has stored a session, or `QOD_TOKEN` holds a personal access token for CI scripts.

:::note DB argument uses the full database name
The `qod federation` commands' `DB` argument (and the underlying `/api/tenants/{tenant}/tenant-dbs/{tenantDb}/federated-sources` REST path) take the **full** database name `${tenant}_${suffix}` (for example `acme_fed`), not the suffix you passed to `qod database create` (`fed`).
:::

## Choosing a database kind for federation

Any database kind can carry federated sources, but a common pattern is a `memory` database that serves *only* federated catalogs, with its default catalog pointed at a federated alias:

```bash
qod database create --tenant acme --name fed --kind memory \
  --default-database fedpg --default-schema public
```

This creates the database `acme_fed` with no persistent DuckLake catalog; sessions resolve unqualified names against the `fedpg` federated alias. See "Tenants and databases" for the full `kind` list.

## Register a federated source

A source is an alias plus the `setupSql` that DuckDB runs at node startup to install the extension, create any secret, and `ATTACH` the catalog.

**`sql` sources are superuser-only.** Their `setupSql` is free-form and runs on the nodes with the manager's rights, so creating or changing a `sql` source answers `403 superuser_required` to a tenant admin on every path (REST, MCP, CLI, manifest import). Typed sources (Postgres, MySQL, Iceberg REST) stay open to tenant admins.

```bash
qod federation create acme acme_fed --alias fedpg --description "Prod warehouse Postgres" \
  --setup-sql "INSTALL postgres; LOAD postgres; CREATE OR REPLACE SECRET fedpg_sec (TYPE POSTGRES, HOST 'pg.prod', PORT 5432, DATABASE 'warehouse', USER 'svc_qod', PASSWORD '{{secret.PG_PWD}}'); ATTACH '' AS {{alias}} (TYPE POSTGRES, SECRET fedpg_sec, READ_ONLY);"
```

The request body fields are `alias`, `setupSql`, optional `description`, and `disabled` (default false). Two placeholders are substituted before the SQL runs on a node:

- `{{alias}}` becomes the source's `alias`.
- `{{secret.NAME}}` becomes the resolved value of the secret named `NAME` (see below). Every secret placeholder must sit inside a plain single-quoted literal (`PASSWORD '{{secret.PG_PWD}}'`), where its value stays a value: a save otherwise answers `400 invalid_federated_source` naming the placeholder, and so does an escape string `E'...'`, dollar quoting or a `$` outside a literal.

The nodes' own S3 keys sign only a database's data path, so a `setupSql` that reads another bucket needs its own `CREATE SECRET`.

A `sql` source is writable by default. To make it read-only, include `READ_ONLY` in the `ATTACH`, which DuckDB enforces at attach time, or set the source's `readOnly` flag (REST `"readOnly": true`), which every node enforces on every statement, for every principal, superusers included; see [Read-only](iceberg.md#read-only) for how the flag works. Neither depends on grants.

List, fetch, and delete sources:

```bash
qod federation list acme acme_fed
qod federation get acme acme_fed fedpg
qod federation delete acme acme_fed fedpg
```

## Secrets

A secret feeds a `{{secret.NAME}}` placeholder. Upsert one with either an inline `value` (stored in Postgres) or an `externalRef` (resolved from an external store at node startup):

```bash
# Value-backed (stored in the control plane)
qod federation secret set acme acme_fed fedpg --name PG_PWD --value hunter2

# External-reference-backed (resolved from a secret store)
qod federation secret set acme acme_fed fedpg --name PG_PWD \
  --external-ref vault:secret/data/qod/fedpg#password
```

Secret values are always redacted on reads: a value-backed secret comes back as `***REDACTED***`, while `externalRef` is returned as-is. Delete a secret with `qod federation secret delete acme acme_fed fedpg PG_PWD`.

**Authoring an `externalRef` secret requires a superuser session.** An `externalRef` directs the manager to resolve a value from its **own** trust domain at node startup (`env:` reads the manager process environment; the KMS prefixes use the manager's ambient cloud / Vault credentials), and that value is inlined into the tenant's node `setupSql`. To prevent a tenant admin from resolving the manager's own secrets (for example `env:QOD_SESSION_JWT_SECRET`) into a table they can read back, the REST/CLI `secret set` path accepts an `externalRef` only from a superuser session; a tenant admin gets `403 superuser_required`. Tenant admins can still author **value-backed** (inline) secrets for their own external credentials, and operator-run bootstrap / manifest imports (themselves superuser-gated) may carry `externalRef` secrets unchanged.

### Secret resolvers

The resolver backend is selected by `QOD_FEDERATION_SECRET_STORE`. The default is `dispatch`, which routes per secret by `externalRef` prefix (inline `value` → `postgres`, `env:` → env, `aws-sm:` / `gcp-sm:` / `azure-kv:` / `vault:` → the matching cloud backend). The single-backend modes `postgres` and `env` are also valid. The single-backend modes `aws-sm` / `gcp-sm` / `azure-kv` / `vault` are **refused at config load** because the resolvers are stubs; deployments that use them through `externalRef` should run under `dispatch` instead. The `externalRef` format depends on the backend:

| Backend | `externalRef` format |
|---|---|
| `env` | `env:QOD_SECRET_FOO` |
| `aws-sm` | `aws-sm:arn:aws:secretsmanager:...` or `aws-sm:name#jsonKey` |
| `gcp-sm` | `gcp-sm:projects/<p>/secrets/<name>/versions/latest` |
| `azure-kv` | `azure-kv:<secretName>` (vault URL from config) |
| `vault` | `vault:secret/data/<path>#<key>` |

The four cloud backends (`aws-sm`, `gcp-sm`, `azure-kv`, `vault`) are still stub resolvers in the current version: under `dispatch` mode the dispatcher keeps them wired so deployments that only consume `postgres` + `env` work without changes; the moment a source's secret carries a stub prefix, the manager raises `NotImplementedError` at node spawn with a message pointing at the supported alternatives. The Admin UI marks the stub options as `(not implemented)` and disables the select. The `postgres` and `env` resolvers are live. See the [Configuration reference](/qod/reference/configuration) for the per-backend config keys.

The substitution that splices a resolved value into `setupSql` is SQL-quote-safe: every `'` in the value is doubled before splicing, so a password like `O'Brien` survives a `PASSWORD '{{secret.PG_PWD}}'` template intact instead of breaking the `ATTACH`. See `FederationBlobBuilderSpec` for the contract.

## Granting access to federated tables

Federated tables are governed by the same RBAC graph as native tables. A `qodstate_role_permission` row on the federated alias (for example `RO`, or SQL `SELECT`, on `fedpg.public.orders`) grants access exactly as it would for a DuckLake table. Use the grant flow on the "Administering access" page, naming the federated alias as the catalog. The mechanics are described in the [Access control model](/qod/operating/rbac-model).

Specifics for federation:

- **A wildcard catalog never covers a federated catalog.** `*.*.*` (the built-in `qod_all_tables` included) covers the pool's own catalog only; grant a federated catalog by its alias (`fedpg.*.*`). A grant naming the alias also lists that catalog's objects in `information_schema`, `duckdb_tables()` and the FlightSQL catalog calls.
- Reads are authorized by an `RO` grant on the alias like any other table.
- Writes (INSERT / UPDATE / DELETE, and DDL) are authorized the same way: an `RW`, `DDL` or `ALL` grant on the alias allows them exactly as it would on a DuckLake table.
- The source's read-only setting refuses a write whatever the grants say: the source's `readOnly` flag, or `READ_ONLY` on a hand-written `ATTACH`. A read-only catalog refuses writes, DDL, `ATTACH` and `DETACH` to every principal, superusers included (`QoD: catalog <alias> is read-only`); a change to the flag applies on the next statement. Not covered: a superuser's raw passthrough (`postgres_execute`, `postgres_query`, `mysql_*`), a maintenance function taking a catalog name, an `ATTACH` of the same source under another alias, and `CHECKPOINT` / `VACUUM`, all superuser-only. `iceberg_rest` sources are read-only by default; `sql` sources, and every source created before the flag existed, are writable by default.

## Lifecycle

- **Edits take effect on the next node spawn.** Creating, editing, or disabling a source changes the catalog blob that every node spawned *after* the change receives: idle-timeout replacements, manual restarts, scale-up additions, and pool recreation. Nodes already running keep their attached catalogs until they exit, so recycle the pool to apply a change immediately.
- **A source that fails at node startup does not stop the node.** The node runs its init SQL statement by statement and carries on past a failing one, so a `setupSql` error (extension missing, bad credentials, DNS failure) goes to the node's log (without DuckDB's `LINE n:` excerpt, since init SQL can carry credentials) and startup continues. The node then passes its health probe and serves every other catalog normally, with this one simply absent, and a client sees `catalog '<alias>' does not exist` rather than the real cause. For `iceberg_rest` sources the manager detects, reports and retries this; see [Attach failures](iceberg.md#attach-failures-and-how-they-surface). For `sql` sources the node's log is the record.
- **Disabled sources** are filtered out when the catalog blob is assembled; there is no live `DETACH` of running nodes. A disabled source's alias stays in the ambiguity guard that applies to principals holding row or column policies (see [Table name resolution](/qod/administration/access-control#table-name-resolution)) because already-running nodes keep it attached until the pool recycles.
- **Recycle the pool right after deleting a source.** Deleting a source removes its alias from that ambiguity guard on the next statement, but running nodes keep the catalog attached until they exit. In that window the guard no longer covers the alias while the engine still binds it catalog-first, so recycle the pool to close the gap.
- **Upgrading `sql` sources to 0.11.0.** Existing `sql` sources keep running; boot WARNs once per source whose author is unknown (a superuser re-saves it unchanged, or deletes it). A template stored before keeps an unquoted placeholder only when its value is a plain token (letters, digits, `_`, `.`, `-`) that no quote or letter touches, such as a port; otherwise that source is left out of the node's setup with a WARN, and boot lists each such template: quote its placeholders and save it again as a superuser. See [Upgrading to 0.11.0](./upgrading.md).

## Backup and restore

Federated sources and their secrets are included in the whole-control-plane config manifest, exported and re-imported through `qod manifest export` and `qod manifest import` (not a federation-specific command). Value-backed secrets are written as `***REDACTED***` in the export, while `externalRef` secrets are written verbatim. On import, federation follows replace-by-alias semantics within each database, and a secret left as `***REDACTED***` (with no `externalRef`) reuses the existing stored value, so a round-trip never requires re-typing passwords. See [Manifest backup and restore](/qod/operating/manifest) for the manifest format and the export/import flow.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `unresolved secret 'X' in source '<alias>'` in the supervisor log | `setupSql` references `{{secret.X}}` but no matching secret row exists | Add the secret with `qod federation secret set <tenant> <db> <alias> --name X --value ...` |
| `unsubstituted placeholder` at boot | A malformed placeholder such as `{{secret.X}` (missing brace) | Fix `setupSql` (`qod federation create` upserts the source) and recycle the pool |
| Client sees `catalog 'fedpg' does not exist` | The pool was not recycled after the source changed | Recreate the pool, or wait for the idle-timeout replacement |
| Client sees `QoD: user:<name> lacks grants on fedpg.public.x:read` | No grant on the federated alias (a wildcard catalog grant does not cover it) | Grant `RO` on the alias (see "Administering access") |
| Client sees `QoD: catalog fedpg is read-only` | The source is read-only | Clear the source's `readOnly` flag (or `READ_ONLY` in its `ATTACH`, then recycle the pool) if writes are intended |
| Tenant admin gets `403 superuser_required` | Creating or changing a `sql` source | A superuser saves it, or use a typed source |
| `400 invalid_federated_source` naming a `{{secret.NAME}}` | The placeholder sits outside a single-quoted literal | Write it as `'{{secret.NAME}}'` |
