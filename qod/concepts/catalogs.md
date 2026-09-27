---
id: catalogs
title: Catalogs
description: "The three database kinds behind a Quack on Demand database, how a DuckLake catalog separates metadata from Parquet data, and how external catalogs such as Iceberg attach alongside it."
keywords: ["ducklake catalog", "duckdb catalog", "iceberg catalog", "federation", "parquet", "metadata", "data path"]
---

Each database (tenant-db) is backed by a catalog that the Quack nodes open. The catalog mode is the database's `kind`. This page explains the three kinds, how a DuckLake catalog separates metadata from data, how the data path is derived, and how external catalogs attach next to the database's own. For creating databases, see [Tenants and databases](/qod/operating/tenants-databases); this page is about how they work.

## The three kinds

| Kind | Catalog | Data | Use |
|---|---|---|---|
| `ducklake` (default) | DuckLake catalog metadata (`ducklake_*` tables) stored in the tenant-db's own Postgres database | Parquet files under `dataPath` (filesystem or object store) | Production, multi-node persistence |
| `duckdb-file` | A standalone `.duckdb` file at `dataPath` | In the same file | Single node only (the file must exist on every node) |
| `memory` | None; ephemeral | None persistent | Federation-only databases (point `defaultDatabase` at a federated alias) |

## How a DuckLake catalog is laid out

A `ducklake` database splits metadata from data:

- **Metadata** lives in the tenant-db's Postgres database as `ducklake_*` tables: the schema, table, and file-manifest records that make up the catalog. This database is separate from the control-plane `qod` database, which only ever holds `qodstate_*` tables and never `ducklake_*` ones.
- **Data** is Parquet, written under the database's `dataPath`, which can be a local filesystem path or an `s3://` / `gs://` / `az://` / `abfss://` object-store URI.

Because the catalog metadata lives in shared Postgres and the data lives in shared storage, **every Quack node in a pool attaches the same DuckLake catalog and sees one consistent view**. That is what makes a `ducklake` database safe to serve from many nodes at once, and why `duckdb-file` (a single local file) is effectively single-node.

When a tenant-db is created the supervisor provisions its Postgres database and then initializes the DuckLake catalog once (the `ducklake_*` tables). The catalog browser in the admin UI reads those tables directly, which is why it is available only in `postgres` state-storage mode.

## Catalog and schema names

A DuckLake database is addressed by a catalog name (`dbName`) and a default schema (`schemaName`). These must differ: a same-named catalog and schema is an ambiguous two-part identifier in DuckDB, which JDBC clients hit on identifier resolution. The router prepends `USE <dbName>.<schemaName>;` to each statement so unqualified names resolve against the right catalog and schema; see [Routing and statement classification](/qod/concepts/routing).

A related guard applies under ACL: a two-part name whose first part matches an attached catalog (the tenant-db itself, a federation alias, or `memory` / `system` / `temp`) is denied as ambiguous and must be written as the full `catalog.schema.table`. See [Table name resolution](/qod/administration/access-control#table-name-resolution).

## Data path derivation

The global default `dataPath` is a root; each tenant-db gets its own subdirectory under it. The supervisor derives the per-database path by replacing the last component of the global default with the composed `${tenant}_${tenantDb}` name. For example a global default of `/var/ducklake/tpch` yields `/var/ducklake/tpch_tpch1` for the `tpch/tpch1` database. Object-store URIs are handled string-wise (so the `//` after the scheme is preserved), because the path DuckLake records in the catalog must match the operator-supplied URI exactly or the next `ATTACH` is refused.

Switching a database to object storage is therefore a matter of setting its `dataPath` to a bucket URI and supplying the S3 credentials; see [Docker deployment](/qod/operating/deploy-docker) for the `QOD_S3_*` keys and the bundled object-store option.

## Snapshots and time travel

DuckLake versions the catalog: every committed transaction writes a snapshot, and all metadata rows (schemas, tables, columns, data files) carry `begin_snapshot` / `end_snapshot` ranges. Snapshots therefore accumulate with write traffic; an append-heavy database collects thousands in weeks. History is linear (no branches), so ordering by snapshot id is the lineage.

The admin UI's catalog browser exposes this history: a per-database snapshots panel (id, commit time, change summary, rows and files added or removed, affected tables) and an "as of" view on each table that shows its schema and parquet files at any retained snapshot. See the [catalog browser](/qod/operating/admin-ui#catalog-browser). Like the rest of the browser, these are metadata reads against the `ducklake_*` tables; they do not query table data and work even when the pool has no running nodes.

Two details worth knowing:

- Small DML can be inlined. DuckLake buffers small inserts and deletes in catalog tables and materializes parquet on the next flush, backdating the files to the snapshot where the change logically happened. AS OF views follow engine semantics, but the current-state row count (from DuckLake's stats) includes inlined rows that the AS OF computation (parquet rows minus delete rows) does not, so the two can briefly differ on a write-hot table.
- Snapshots are retained until expired. Expiry is a DuckLake maintenance operation (`ducklake_expire_snapshots()` followed by `ducklake_cleanup_old_files()`), not something the manager runs automatically; the browser shows whatever history the catalog retains, and time travel reaches back only to the oldest retained snapshot.

## Native and attached catalogs

A session sees two kinds of catalog side by side:

- The **native catalog** is the database's own, of the kind above. For a `ducklake` database QoD provisions its metadata, derives its data path and, through the admin UI, browses its snapshots. Branching and time travel are features of this catalog.
- **Attached catalogs** are federated sources: Postgres, MySQL, an Iceberg REST catalog, or anything else a DuckDB extension can `ATTACH`. Each is attached under its own alias, and its data stays where it is. QoD does not copy it, convert it or run maintenance on it.

A federated source is either a free-form `sql` source, where the operator writes the `ATTACH` and QoD substitutes secrets into it, or a typed `iceberg_rest` source, declared as fields (endpoint, warehouse, auth mode) from which QoD renders the `ATTACH` itself. See [Federation](/qod/operating/federation) and [External Iceberg catalogs](/qod/operating/iceberg).

### When a catalog is attached

Attached catalogs are bound when a node spawns, not per query. The supervisor resolves each source's secrets and runs its `ATTACH` as part of the node's init SQL. Two consequences follow:

- Authentication to the external system happens once, at `ATTACH`. There is no per-statement authentication cost, and no per-statement retry either.
- A source change reaches nodes spawned after it. Running nodes keep what they attached until they exit, so recycling the pool applies a change immediately.

A failed `ATTACH` does not stop the node: it boots and serves every other catalog, with the failed one absent. For Iceberg sources the manager detects this, reports it per source and per node, and retries; see [Attach failures](/qod/operating/iceberg#attach-failures-and-how-they-surface).

### Who does what for Iceberg

The DuckDB `iceberg` extension does the protocol work: it performs the OAuth2 exchange, refreshes the token, and requests per-table vended storage credentials from the catalog. QoD proxies neither, so it holds no access token and, for a catalog that vends credentials, no storage key. What QoD adds is a validated declaration of the catalog, secret resolution at node spawn, a per-catalog read-only switch, and attach-failure reporting.

An Iceberg catalog is read-only by default, since QoD does not own it. Making it writable is an explicit per-source choice, and writes then commit through the external catalog.

### Addressing and access control

Attached tables are addressed as `alias.schema.table` and pass through the same statement pipeline as native tables: the same RBAC graph, the same `RO` / `RW` / `DDL` verbs, and the same audit trail. A grant names the alias as its catalog, and a write needs the same `RW` or `DDL` grant it would need on a native table; there is no separate rule denying writes to attached catalogs. The per-source read-only setting is the one thing that refuses a write whatever the grants. Since the ACL is off by default (`QOD_ACL_ENABLED=false`), that setting is also the only write protection an attached catalog has until the ACL is enabled. The ambiguity guard from [Catalog and schema names](#catalog-and-schema-names) covers every alias, so a two-part name whose first part is an attached catalog must be written in full.

Two limits come from the mapping itself. Iceberg allows multi-level namespaces while DuckDB has a single schema level under a catalog, so a table in namespace `a.b` is not addressable. And features written against DuckLake catalog tables, such as [branching](/qod/operating/branching) and the catalog browser's snapshot history, do not apply to attached catalogs.
