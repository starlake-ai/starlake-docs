---
id: rbac-model
title: "Access control model: RBAC, row and column security for DuckDB"
sidebar_label: "Access control model"
description: "The role-based access control model enforced on every DuckDB statement: roles, groups, table verbs, row-level policies, column masking, two gates."
keywords: ["duckdb rbac", "duckdb access control", "row-level security", "column masking", "duckdb acl", "permissions"]
---

This page describes the role-based access control (RBAC) model quack-on-demand enforces on every statement, whichever door it arrives through (FlightSQL, the native Quack front door, MCP or a REST endpoint that runs SQL). It covers the data model, how effective permissions are computed, what the node checks on each statement, and where superusers fit. For step-by-step instructions on creating users, roles, groups, and grants, see the "Administering access" page, or [Administer with SQL](/qod/administration/sql-administration) to do the same from any connected SQL client.

Enforcement is always on. Since 0.11.0 the node that runs a statement decides it, on the plan DuckDB bound, and there is no switch to turn it off: `QOD_ACL_ENABLED`, `QOD_ACL_FILTERED_METADATA` and `QOD_ACL_DIALECT` were removed, and a manager that still sets one refuses to start (see [Upgrading to 0.11.0](./upgrading.md)).

## Pools and databases

Access to a database is granted through pools, so it helps to be precise about how the two relate before looking at table permissions.

- A **tenant** owns one or more **tenant-dbs**. A tenant-db *is* a database: in the default `ducklake` kind it is a Postgres database holding a DuckLake catalog, with a catalog name and a default schema.
- A **pool** is a set of DuckDB Quack nodes and is bound to exactly one tenant-db (`qodstate_pool.tenant_db_id`). Every node in the pool opens that tenant-db's catalog. A pool's full identity is the triple `(tenant, tenantDb, pool)`, the `PoolKey`.
- A client handshake supplies only a `tenant` and a `pool` (via gRPC headers / URL params). The gateway resolves which tenant-db that pool belongs to server-side; the client never names the database directly. JWT claims are never trusted for routing - the URL is authoritative.

The consequence is the part that is easy to miss: **admission to a pool is admission to that pool's database.** The pool-access check (gate 1 below) is therefore the database-access gate. Granting a user or group a `qodstate_pool_permission` row for pool `p` is what lets them open a session against `p`'s tenant-db; a principal with no pool permission reaching a tenant-db cannot query that database at all, regardless of any table grants they hold. Once admitted, the tenant-db's catalog name and default schema become the session's defaults, which the per-statement gate uses to qualify unqualified table names.

Table permissions (the rest of this page) then decide *which tables inside the reachable databases* a statement may touch. The two are independent: pool access decides the database; table permissions decide the tables.

## Entities

The RBAC graph is stored in the control-plane Postgres database (default `qod`) using tables with the `qodstate_` prefix.

### Core objects

| Table | What it holds |
|---|---|
| `qodstate_user` | One row per principal. `tenant IS NULL` marks a superuser. Tenant-scoped users carry a non-null `tenant` value. The `kind` column (`admin` or `user`) is the management-rights flag (admin console and REST administration); it is not an RBAC role and grants no table or pool access. |
| `qodstate_role` | Named, per-tenant bundles of table permissions. |
| `qodstate_group` | Named, per-tenant containers that collect roles and pool grants. |
| `qodstate_role_permission` | Table-level grants attached to a role: a verb on a `catalog.schema.table` triple. |
| `qodstate_pool_permission` | Pool-access grants attached to a user or a group. A null `pool_id` matches every pool in the tenant. |

### Membership edges

| Table | Relationship |
|---|---|
| `qodstate_user_role` | Direct user-to-role assignment. |
| `qodstate_user_group` | User membership in a group. |
| `qodstate_group_role` | Role assignment to a group. |

A user therefore reaches table permissions through two paths: directly via `qodstate_user_role`, or indirectly via any group they belong to and that group's `qodstate_group_role` edges.

### Built-in roles and groups

Every tenant carries four protected built-ins, flagged `builtin: true` in role and group responses:

| Name | Type | Holds |
|---|---|---|
| `qod_all_tables` | role | One permission: `ALL` on `*.*.*` (every table of the tenant). |
| `qod_no_tables` | role | Nothing. |
| `qod_all_pools` | group | One tenant-wide pool grant (null `pool_id`: every pool of the tenant). Carries no roles. |
| `qod_no_pools` | group | Nothing. Carries no roles. |

Their definition is frozen: deleting them, changing a built-in role's permissions or column and row policies, binding roles into a built-in group, or changing a built-in group's pool grants answers `409 builtin_protected`. Adding and removing users stays allowed, and a built-in role may be bound into a custom group. The `qod_` name prefix is reserved for them (case-insensitive): creating a role or group whose name starts with it answers `400 reserved_name`.

They are seeded when a tenant is created, on manifest import, and by an idempotent backfill that runs on every manager boot for existing tenants. The backfill renames a user-made role or group already holding a built-in name to `<name>_renamed` (or `<name>_renamed_N`), and folds a pristine legacy `admin` role (exactly one `ALL` on `*.*.*` permission, no column or row policy) into `qod_all_tables`, moving its users and groups over. New tenants no longer get an `admin` role.

### Memberships at user creation

Creating a tenant user (REST, CLI, MCP, SQL `CREATE USER`, or the admin UI) takes the list of role names and the list of group names to attach. An omitted list defaults to `qod_all_tables` and `qod_all_pools` respectively, so a user created without lists gets **full data access to every table and every pool of the tenant**. To start a user from nothing, pass `qod_no_tables` / `qod_no_pools` (or your own roles and groups) explicitly. An explicitly empty list is refused (`400 roles_required` / `groups_required`), and so is an unknown name (`400 unknown_role` / `unknown_group`). Superusers take no lists (`400 memberships_not_applicable`). SCIM provisioning and manifest import attach no defaults, and re-creating an existing user through REST attaches only the lists the request names.

## The EffectiveSet

At handshake time the gateway computes a closed permission set for the connecting user and binds it to the session. Every statement runs under that set, resolved again first when the tenant's policy version has moved (see [Revocation and the policy version](#revocation-and-the-policy-version)).

The closure is defined as:

```
effective_roles(U)  = direct_roles(U)  ∪  ⋃ roles(g)   for g ∈ groups(U)
effective_pools(U)  = direct_pools(U)  ∪  ⋃ pools(g)   for g ∈ groups(U)
                      (pool_id IS NULL matches every pool in the tenant)
effective_perms(U)  = ⋃ permissions(r)                  for r ∈ effective_roles(U)
```

Where:
- `direct_roles(U)` are the `qodstate_user_role` rows for the user (fetched from Postgres at handshake time).
- `groups(U)` are the `qodstate_user_group` rows for the user (also fetched at handshake time).
- `roles(g)` are resolved from the in-memory `RbacResolver` cache, which mirrors all `qodstate_group_role` edges for the tenant without loading user-bound state.
- `permissions(r)` are the `qodstate_role_permission` rows for each effective role, also served from the in-memory cache.

The `RbacResolver` holds the schema-bounded slice of the graph (roles, groups, role permissions, group-role edges, group-scoped pool permissions). Its memory footprint is bounded by tenant cardinality, not by the number of users. User-bound state (user-role and user-group edges) is intentionally excluded from the cache and fetched when a set is resolved.

The full `EffectiveSet` is also cached in `PoolSupervisor` with a 60s TTL keyed by `(userId, jwtRoles.hashCode, jwtGroups.hashCode)` - under load the same user + claims tuple repeats every few seconds, so the cache collapses N handshakes' worth of work into one. Every RBAC mutator (`createRole`, `grantRolePermission`, `addUserRole`, `addGroupRole`, `grantPoolPermission`, etc.) calls `invalidateEffectiveCache()`, so a freshly-granted role takes effect on the next statement regardless of the TTL.

The handshake produces an `AuthorizedHandshake` that carries the resolved `PoolKey`, the matched user row, and the full `EffectiveSet`. The gateway keeps it with the session; the column and row rewriters read it, and so does the replica that answers the node's verdict requests.

### Revocation and the policy version

Every tenant carries a policy version (`qodstate_tenant.policy_version`), bumped by any change to its users, roles, role permissions, groups, memberships, pool permissions, row and column policies, ACL mode, OPA settings, authorized folders and users' S3 keys; a change to any database's data folder moves every tenant's version. Before a statement runs, a session whose tenant moved past the version its set was resolved under runs the handshake's gates again. A revoke therefore reaches open FlightSQL and native sessions on their next statement (inside an open native transaction too, which it ends: `transaction aborted: <reason>; ROLLBACK to continue`), and a re-grant restores them without a reconnect. A user disabled, deleted or removed from the pool is refused on the next statement; a control-plane outage during that check is a retryable `UNAVAILABLE`.

## Superusers

A user with `tenant IS NULL` in `qodstate_user` is a superuser. Superusers bypass both gates:

- The pool-access gate at handshake (they may connect to any pool in any tenant).
- The per-statement gate: the node still describes their statements (the audit log gets the real objects) but allows them without checking `effective_perms`.

A few mechanism rules still bind superusers: writes, DDL, `ATTACH` and `DETACH` against a [read-only federated catalog](./federation.md) are refused to every principal, and so is changing the optimizer and Quack authorization settings (`QoD: <name> cannot be changed`).

The superuser flag is purely the absence of a tenant value. The bootstrap admin seeded at startup is a superuser. Only superusers can create other superusers; the API enforces this constraint at the application layer.

User names confer nothing. A tenant user may be called `superuser` and is still an ordinary tenant user: statements the manager runs on a caller's behalf (the catalog preview, data diff, undrop and restore endpoints, and the MCP tools that run SQL) bypass the grant check, column masking and row policies only for a real superuser (`tenant IS NULL`, through a superuser session or a PAT a superuser owns) and the manager's own internal steps, never because of a name. Everyone else, including a PAT, runs as their own principal with these gates applied, after the same handshake gates as FlightSQL (tenant and pool kill switches, user registered and enabled, pool access); see [Relationship to the REST session](/qod/connecting/authenticating#relationship-to-the-rest-session).

A superuser logs in via the system auth realm: on the UI the **Tenant ID** field is left blank; on FlightSQL the URL carries `?superuser=true` alongside the routing `tenant=X&pool=Y` params. The tenant-realm path looks up `qodstate_user WHERE tenant = ?` and never matches a `tenant IS NULL` row, so a superuser cannot accidentally be authenticated through the tenant realm. See [Authentication](/qod/operating/authentication) for the realm-selection mechanics.

## Table permissions

Each `qodstate_role_permission` row grants one verb on one table triple to a role.

### Verbs

The node describes every object a statement touches with the access DuckDB resolved for it (`read`, `insert`, `update`, `delete`, `create`, `drop`, `alter`), and the verdict collapses each into one of three access classes: `read` is `Read`; `insert`, `update` and `delete` are `Write`; `create`, `drop` and `alter` are `Ddl`. A grant verb is matched against that class. The grant vocabulary is the four values below.

| Grant verb | Covers (access class) |
|---|---|
| `RO`  | `Read` only (SELECT, and the read side of subqueries / CTEs / `INSERT ... SELECT`). |
| `RW`  | `Read` and `Write` (any DML on the matched tables: INSERT, UPDATE, DELETE, MERGE, UPSERT, TRUNCATE). |
| `DDL` | `Ddl` only (CREATE / DROP / ALTER on the matched tables). |
| `ALL` | `Read`, `Write`, and `Ddl` on the matched tables. |

`RW` is the only multi-class grant: it bundles `Read` so that a data worker who can write to a table can also read it, which matches every real-world DML workload. DDL is intentionally separate because CREATE / DROP / ALTER are higher-privilege. One statement can need both: `ALTER TABLE ... ADD COLUMN ... DEFAULT <expr>` is judged as DuckDB runs it, an ADD COLUMN and an UPDATE, so it needs `ALL` (or `RW` and `DDL`) on the table. A schema-wide access (`CREATE`, `DROP` or `ALTER SCHEMA`) needs a grant whose table part is `*`.

### Wildcards

Each of the three name parts (catalog, schema, table) may be the literal string `*`, which matches any value in that position. For example, a permission with `catalogName=*`, `schemaName=*`, `tableName=*`, `verb=RO` grants read access to every table the user can name.

Matching is case-insensitive for literal values and exact for `*`.

The catalog `*` wildcard is scoped to the session's tenant: it matches the tenant's own databases and the catalog the pool's node attaches its database as (`memory` on a memory database's own pool, or a custom alias such as a `qod serve` `.duckdb` file's stem). A tenant admin holding `*.*.* ALL` therefore cannot reach a sibling tenant's catalog. **A wildcard catalog never covers a federated catalog**: grant a [federated source](./federation.md) by its alias (`pgsrc.public.* RO`). A literal catalog name always matches through the literal path.

### How a grant covers a table access

For each statement the SQL parser produces a set of accesses, each a `(table, class)` pair where `class` is `Read`, `Write`, or `Ddl`. An access is covered by a permission row `p` when all of these hold:

1. `p.verb` covers the access class (see the Verbs table: `ALL` covers any class; `RO` covers `Read`; `RW` covers `Read` and `Write`; `DDL` covers `Ddl`).
2. `p.catalogName` matches the access catalog (literal match, or the tenant-scoped `*` wildcard described above).
3. `p.schemaName` is `*` or matches the access schema.
4. `p.tableName` is `*` or matches the access table.

If any access in the statement is not covered, the whole statement is denied.

## Statement coverage

The node judges the plan DuckDB bound, not the SQL text, so names are resolved exactly as DuckDB resolves them (search path, `USE`, attached catalogs) and every object a view, macro or `query()` hides is in the plan. Each object access must be covered; if any is not, the whole statement is refused with `QoD: user:<name> lacks grants on <catalog.schema.table>:<access>`.

### Reads, writes and DDL

Every table or view a statement reads (FROM clauses, JOINs, subqueries, CTEs, set operations, `RETURNING`) is a `Read` access and needs `RO`, `RW` or `ALL`. The target of INSERT, UPDATE, DELETE or MERGE is a `Write` access and needs `RW` or `ALL`; holding `RW` on the target alone is not enough to read from a different source table. The target of CREATE, DROP or ALTER is a `Ddl` access and needs `DDL` or `ALL`; a `CREATE TABLE ... AS SELECT` source still needs its own read grant.

### Views

- A **plain view** runs with its reader's rights: the reader needs a grant on what the view reads, not on the view itself.
- A **secure view** runs with its owner's rights: a read grant on the view covers what it reads. Only superusers create secure views, written fully qualified over base tables, built-ins and other secure views. Any secure view is refused for as long as the session holds a temporary view, macro or type, a `SET VARIABLE` variable, a changed session setting other than `schema` / `search_path`, or a search path other than its default (`QoD: statement uses a secure view while the session ...`). A client that sets `TimeZone` on connect loses secure views for that session.

### Functions, settings and statement types

Every function and setting a statement calls must be classified. A function the classification does not list (a misspelled one included) reads `QoD: function <name> is not classified`; so does a macro a superuser created, until it is called as `system.main.<name>` or classified. A view, generated column, column default, CHECK constraint or trigger that calls such a function, a user macro, or a `query()` with a computed argument makes its table or view unreadable (or unwritable) for tenant users, and so do views nested more than 16 deep. Literal `query('<sql>')` and `query_table('<name>')` are admitted and judged on what they bind. `SET` / `RESET` of a session setting (`TimeZone`, `search_path`, `schema`, `SET VARIABLE`, ...) is admitted; node-wide, credential and I/O settings are superuser-only (see [Hardening](./hardening.md#node-enforcement-always-on)). `BEGIN`, `COMMIT`, `ROLLBACK` and `USE` need no grant.

Tenant users are always refused, whatever their grants: `CREATE MACRO`, trigger DDL, `CREATE` / `DROP SECRET`, `ATTACH`, `IMPORT` / `EXPORT DATABASE`, `CONNECT`, extension `INSTALL` / `LOAD`, `DESCRIBE (<query>)` / `SUMMARIZE (<query>)`, a PRAGMA off a read-only list, `current_setting()`, `pg_get_viewdef`, `duckdb_memory()`, and the catalog-wide listings nothing filters yet (`duckdb_constraints()`, `duckdb_indexes()`, `duckdb_sequences()`, `duckdb_triggers()`, `duckdb_types()`, `duckdb_functions()`, `duckdb_dependencies()`). A plan the node cannot describe is refused to every principal (`statement uses <X>, which QoD does not support`); there is no `*.*.* ALL` escape.

### Catalog listings

A tenant user's catalog listings are always narrowed to the objects they are granted: `information_schema.schemata`, `tables`, `columns` and `views`, named so in the statement itself, and `duckdb_schemas()`, `duckdb_tables()`, `duckdb_views()` and `duckdb_columns()`. Each grant is pinned to the catalog it covers, so a grant on `lake.main.*` does not list another attached catalog's `main`, a grant naming a federated catalog (`pgsrc.public.*`) lists that catalog's objects, and a wildcard catalog lists the pool's own catalog only. An `RO` grant on `information_schema` gives a principal unfiltered listings.

DuckDB's other built-in listing views are refused to every non-superuser, however they are named or nested (bare, `pg_catalog.` or `system.`, in a subquery, a CTE, a `query()` string or a view body): `pg_catalog`'s views (`pg_tables`, `pg_views`, `pg_attribute`, ...), `sqlite_master`, the parenless `duckdb_tables` / `duckdb_views`, `system.information_schema.*`, bare `SHOW` and `DESCRIBE`, `SHOW TABLES FROM ...`, `SHOW SCHEMAS`, `SHOW DATABASES` and `SHOW VARIABLES` (`SELECT * FROM duckdb_variables()` lists the session's variables instead). A grant covering them, `*.*.*` included, does not admit them. The gateway answers a top-level `SHOW TABLES` / `SHOW ALL TABLES`, `DESCRIBE <table>`, `SHOW <table>`, `PRAGMA table_info('<table>')` and `SUMMARIZE <table>` from the filtered listings plus a read of the object, so they need a read grant on it (DESCRIBE's `key` and table_info's `pk` come back NULL; on an OPA tenant these answers are empty and SUMMARIZE is refused).

### Files

A tenant user reads or writes a file by path only through a file reader or `COPY`, and only under an S3 scope they registered keys of their own for, or a local folder their tenant authorized; never a database data folder. A `COPY t FROM` is a write to `t`, a `COPY ... TO` reads what its query reads. A location computed from constants (`read_csv('s3://b/in/' || strftime(today(), '%Y%m%d') || '.csv')`) is evaluated by the node as the user and judged as the literal it yields. See [Hardening](./hardening.md#files-and-s3).

### Earlier snapshots and the change feed

A DuckLake table read at an earlier snapshot (`AT (VERSION => n)`, `AT (TIMESTAMP => ...)`) or through DuckLake's change feed is judged by the table's DuckLake id: as the table that id names now, under its current name and columns, whatever name the statement wrote. That covers time travel, the data diff, branch change counts, the restore dry run and undrop.

- **Renamed since:** judged as the table it is now, on its current name's grant. A grant on a table that later took the old name does not cover it.
- **Replaced since** (`CREATE OR REPLACE`, a QoD restore): the same table, so its history is judged on the current name's grant.
- **Dropped since:** judged as a read of its last live name, allowed while no live table or view holds that name and the grant covers it. Once the name is reused, only a superuser reads it.
- **Users with column or row policies** are refused all three, on any table: the policy rewriters match the names a statement writes, not the table's id. The reason ends `not available to principals with column or row policies`.

A `TIMESTAMP` is resolved in the client's `TimeZone`. A dropped table read `AT (TIMESTAMP => ...)` can be refused when the node cannot pin the timestamp to the same snapshot DuckLake reads (sub-microsecond rounding, a session `TimeZone` it cannot apply): read it `AT (VERSION => n)` instead, which is never affected.

DuckLake's change feed, `ducklake_table_changes`, `ducklake_table_insertions` and `ducklake_table_deletions`, is admitted to tenant users as a read of the table it names, which it must name by literals (`QoD: ... needs its catalog, schema and table as literals, and its two snapshot bounds` otherwise). Its change rows cannot be masked or filtered, so it stays refused to a user with any column or row policy. Superusers read either without a grant check, as everything else.

## Column-level policies

The table-level ACL described above is "all-or-nothing" per table: once a role has `RO` on `customer`, every column on `customer` is readable. Many regulated workloads (GDPR, HIPAA, PCI) need finer control: a role may read `customer` but `c_ssn` is forbidden, or `c_email` is returned as `'***'` instead of the raw value. The column-policy system enforces these patterns by rewriting the user's SELECT before it reaches a Quack node.

### Data model

Policies live in `qodstate_role_column_policy` (one row per `(role, catalog, schema, table, column)`) and attach to roles only; users inherit them through the same role-membership graph as table permissions.

| Column | Meaning |
|---|---|
| `role_id`        | The role that carries the policy. |
| `catalog_name` / `schema_name` / `table_name` | The protected table. `*` wildcards work the same way as for table permissions, including tenant scoping on `catalog_name`. |
| `column_name`    | The protected column. **Always literal - `*` is rejected.** A wildcard column policy would mean "deny everything", which is already expressible via absence of a table-level grant. |
| `action`         | `deny` (refuse any query that references the column) or `mask` (return a transformed value). |
| `transform_sql`  | The transform expression. `NULL` for `deny`; a strict-containment-validated scalar SQL expression for `mask`. |

`UNIQUE (role_id, catalog_name, schema_name, table_name, column_name)` so updates replace in place. `ON DELETE CASCADE from qodstate_role` so dropping a role drops its policies.

### Where the rewriter sits in the pipeline

```
client SQL
   │
   ▼  ColumnPolicyRewriter (at the gateway)
   │     - parses the SQL via JSqlParser
   │     - walks every PlainSelect reachable (projections,
   │       WHERE / HAVING, subqueries, CTE bodies, UNION arms)
   │     - expands `SELECT *` against the DuckLake column catalog
   │     - for each column reference, looks up a matching policy
   │         · `deny` → refuses the query (403)
   │         · `mask` → replaces the reference with `transform_sql`
   │
   ▼  adapter sends the rewritten SQL to the node, which decides
      the table access on the plan DuckDB binds for it
```

The rewriter only runs for SELECT-shaped statements; DML and DDL pass through unchanged (the node decides whether the user can write to the target). Statements that fail to parse are passed through unmodified - DuckDB returns the syntax error to the client, just as it does today.

Superusers bypass the rewriter, matching their bypass of the grant check.

### Column-level security guarantees

The rewriter walks every projection-eligible JSqlParser node kind: direct column references,
CASE arms, CAST inner, IN list members, BETWEEN bounds, EXTRACT inner, window PARTITION BY and
ORDER BY expressions, LIKE patterns, and row constructors. Star (`*`) projections are expanded
against the DuckLake catalog before the policy walk, so multi-table joins and qualified `t.*`
both apply per-column policies. CTE, FROM-item subqueries, scalar subqueries in projection, and
UNION / INTERSECT / EXCEPT arms are all recursed into; the v1 bypass list is closed.

CTE and view indirection are resolved at the physical (table, column) level via jsqltranspiler's
lineage tree. A column projected through `WITH x AS (SELECT c_email FROM customer) SELECT c_email
FROM x` is masked according to the base table's policy. For FROM-item subqueries
(`SELECT c_email FROM (SELECT c_email FROM customer) sub`) the rewriter synthesises a transient
outer-scope policy keyed on `(subAlias, exposedName)` so the outer projection is masked too,
since jsqltranspiler's lineage stops at the FROM boundary.

### Kill switch (feature flag)

Column-level security ships **enabled by default**. Operators opt out
by setting `quack-on-demand.cls.enabled = false` (or env `QOD_CLS_ENABLED=false`). When disabled,
every statement bypasses the rewriter completely: no FROM-table catalog lookup, no
jsqltranspiler call, no per-statement overhead. The behaviour matches a build with column
policies absent. Treat the toggle as a kill switch you can flip off in an incident: change
the env var and restart the manager.

Known limitations: federated sources, `LateralSubSelect` / `TableFunction` FROM items, and
the 5-second catalog cache TTL race documented below. Standard SELECT, JOIN, CTE, UNION,
subquery, CASE, CAST, IN, BETWEEN, EXTRACT, window, and LIKE constructs are covered by tests.

### Unresolved-table behaviour

When the rewriter encounters a table the DuckLake catalog cannot enumerate (federated alias
the catalog does not expose, metadata fetch raced a DDL), the request falls back per
`QOD_CLS_UNRESOLVED_TABLE`:

- `pass` (default): forward the unrewritten SQL to DuckDB. Matches v1 behaviour.
- `deny`: refuse the statement with an "unknown table" error. Safer; recommended for
  production tenants where any unexpected SQL is suspicious.

### Catalog cache and schema evolution (known limitation)

`DuckLakeColumnCatalog` caches column-name lookups at a 5-second TTL. After a `CREATE / ALTER /
DROP TABLE` or column DDL, the rewriter sees a stale column list for up to 5 seconds. Concrete
race: a freshly-added column plus a freshly-added policy on it leaves a window where the policy
lookup runs but the resolver does not see the new column. In `pass` mode the unmasked SQL
reaches DuckDB during this window; in `deny` mode the statement is denied. Operators expecting
simultaneous DDL + RBAC changes should pin tenants to `deny` mode, or accept the 5-second
exposure on `pass`.

A future release will hook DDL classification into cache invalidation so the window closes to
under one statement; until then this is operator-visible.

### Action: deny

A `deny` policy refuses any query that references the protected column anywhere - projection, WHERE clause, HAVING, GROUP BY, ORDER BY, JOIN condition, subquery, CTE body - and short-circuits with a 403 carrying the column qualifier. `SELECT *` deny is fail-closed: if star expansion uncovers a denied column, the query is refused rather than silently dropping the column from the projection.

### Action: mask + transform_sql

A `mask` policy replaces every reference to the column with the operator-authored `transform_sql` expression. The replacement happens in place: composite expressions like `length(c_email)` become `length('***')`; predicates like `WHERE c_email LIKE '%@acme.com'` become `WHERE '***' LIKE '%@acme.com'` (which trivially matches no rows, the right behaviour for a masked column under predicate inference). Projection aliases are preserved (`SELECT c_email AS e FROM customer` stays aliased as `e`).

`transform_sql` is **strict-containment-validated** at policy create time. The validator runs once when the operator writes the policy and rejects expressions that would let the policy leak its own column:

1. The expression parses as a single scalar SQL expression.
2. Every column reference in the expression names only the protected column (case-insensitive). `concat(c_email, c_phone)` is rejected when the policy is on `c_email`.
3. No subqueries, `EXISTS`, or any other form of nested SELECT.
4. No side-effect or escape functions: the denylist includes `read_csv`, `read_parquet`, `read_json`, `attach`, `detach`, `install`, `load`, `system`, `current_setting`, `set_setting`, `pg_read_server_files`, `pg_read_binary_file`, and anything matching `pragma_*` (prefix).
5. Canonical form ≤ 1024 chars.

A failed validation returns `400 invalid_policy` with the violated rule named in the message. Typical valid expressions:

| `transform_sql` | Meaning |
|---|---|
| `'***'`                                           | constant string |
| `NULL`                                             | scrub to NULL |
| `md5(c_email)`                                     | hash |
| `concat('user_', md5(c_email))`                    | prefix + hash |
| `regexp_replace(c_phone, '\d', 'X')`               | character substitution |
| `concat('****', substr(c_phone, length(c_phone) - 3, 4))` | last-4 reveal |

### SELECT * expansion

When the user issues `SELECT *` (or `SELECT t.*`), the rewriter reads the column list from the DuckLake catalog and expands the star to a literal projection BEFORE applying policies. Operators see the same number of columns the table actually has, with masked columns rewritten in place. When the catalog cannot enumerate the table (federated source temporarily unreachable, etc.), the rewriter passes the original `*` through - the node still decides whether the user can read the table in the first place. A `column_policy_catalog_lookups_total{result=error}` metric surfaces this case for operators.

### Effective policies and caching

Column policies join the `RolePermission` and pool-permission rows in the per-user `EffectiveSet`. The same 60-second `PoolSupervisor` cache covers them, and the same mutator-invalidation contract applies: `createColumnPolicy`, `updateColumnPolicy`, and `deleteColumnPolicy` each call `invalidateEffectiveCache()`, so a freshly-authored policy takes effect on the next statement regardless of the TTL.

Per-statement cost is in-memory only: a small AST walk + per-column lookup against the cached `EffectiveSet.columnPolicies` list. No Postgres traffic on the hot path.

### Observability

Three Micrometer metrics expose the rewriter's behaviour:

| Metric | Tags | Use |
|---|---|---|
| `column_policy_rewrites_total`       | `tenant`, `pool`, `outcome` ∈ `{rewritten, denied, unresolved_deny, parse_failed, passthrough}` | Fraction of reads paying the rewrite cost; spot policy regressions. |
| `column_policy_catalog_lookups_total` | `tenant`, `pool`, `result` ∈ `{hit, miss, error}` | `ColumnCatalog` cache effectiveness; alert on `error > 0` to catch federation breakage. |
| `column_policy_rewrite_duration_seconds` | `tenant`, `pool` | Histogram of rewrite step wall time; alert on percentile regressions. |

The `column_policy_rewrites_total{outcome=...}` counter emits five outcomes:

- `rewritten`: at least one projection or predicate column was replaced with a mask transform.
- `denied`: a deny policy matched a referenced column.
- `unresolved_deny`: `QOD_CLS_UNRESOLVED_TABLE=deny` refused a query because the catalog did
  not know the referenced table.
- `parse_failed`: jsqltranspiler could not parse / resolve the SQL; the original statement is
  forwarded unchanged. Distinct from `passthrough` so operators can tell "rewriter inactive
  because nothing to rewrite" from "rewriter inactive because it gave up".
- `passthrough`: the rewriter inspected the SQL and decided no rewrite was needed (no covered
  column referenced; non-SELECT; superuser; user has no column policies).

`Denied` outcomes also surface in the statement-history view (with `status=denied` and the offending column qualifier in the error message) and in the audit log line `column policy denied: user=… column=… role=… statement=…`.

### Authoring

Column policies are administered the same way as table permissions: via REST endpoints under `/api/role/column-policy/{create,update,delete,list}`, via the admin UI's "Column policies" tab on the role detail page, and via YAML manifest (`columnPolicies` list under each role). The bundled demo manifest (`bootstrap-demo.yaml`) ships an example mask policy on `acme/analyst/customer.c_phone` so a fresh `LOAD_TPCH=1` boot demonstrates the feature end-to-end without manual setup.

## Row-level policies

Column policies restrict *which columns* a role sees; row policies restrict *which rows*. Where column-level security blanks out `c_ssn`, row-level security drops the customer records a role is not allowed to see in the first place - a salesperson sees only their own region's orders, a tenant analyst sees only rows tagged with their tenant id, an auditor sees everything. Like column policies, row policies are enforced by rewriting the user's SELECT before it reaches a Quack node; unlike column policies, the rewrite pushes a boolean filter down onto each protected table rather than transforming the projection.

### Data model

Policies live in `qodstate_role_row_policy` (one row per `(role, catalog, schema, table)`) and attach to roles only; users inherit them through the same role-membership graph as table permissions.

| Column | Meaning |
|---|---|
| `role_id`        | The role that carries the policy. |
| `catalog_name` / `schema_name` / `table_name` | The protected table. `*` wildcards work the same way as for table permissions, including tenant scoping on `catalog_name`. A `table_name = '*'` policy filters every table the query touches - useful for a tenant-id predicate that should apply everywhere. |
| `predicate_sql`  | A boolean SQL expression that admits a row when it evaluates true. May embed identity-substitution tokens (see below). Validated at create time. |

`UNIQUE (role_id, catalog_name, schema_name, table_name)` so updates replace in place; a role carries at most one predicate per exact table tuple (a wildcard policy and a specific-table policy are different tuples and both apply). `ON DELETE CASCADE from qodstate_role` so dropping a role drops its policies.

### Where the rewriter sits in the pipeline

The row rewriter runs *after* the column rewriter, so the two compose with row filtering innermost:

```
client SQL
   │
   ▼  ColumnPolicyRewriter (masking / deny)              ─── outer
   │
   ▼  RowPolicyRewriter                                  ─── inner
   │     - parses the (already column-rewritten) SQL
   │     - walks every table reference reachable
   │       (FROM, JOINs, subqueries, CTE bodies, UNION arms)
   │     - for each table with a matching policy, replaces it with
   │         (SELECT * FROM <table> WHERE <predicate>) <alias>
   │
   ▼  adapter sends the rewritten SQL to the node, which decides
      the table access
```

Pushing the predicate onto the **base relation** (rather than wrapping the whole query in an outer `WHERE`) is what keeps the filter correct under joins (each table filters independently), aggregation (rows are dropped *before* `GROUP BY`), `LIMIT`/`DISTINCT`/set operations (filtering happens before they apply), and projections that do not select the predicate's columns. It also means the filter runs on the *true* (unmasked) values, so a row policy keyed on a column that a column policy masks still filters correctly. This matches the semantics of Postgres RLS and Snowflake row-access policies, where the predicate is a property of the table scan.

The rewriter only runs for SELECT-shaped statements; DML and DDL pass through unchanged. Statements that fail to parse are forwarded unmodified (tagged `parse_failed`). Superusers (tenant `NULL`) bypass the rewriter entirely.

### Row-level security guarantees

Every table occurrence reachable from the statement is considered: the top-level `FROM` item, each `JOIN` right-hand item, parenthesised subqueries, and CTE (`WITH`) bodies are recursed into. A table matches a policy when its `(catalog, schema, table)` - resolved against the session's default catalog/schema for bare names - equals the policy tuple component-wise, with `*` matching anything. When a table matches more than one of the principal's policies (e.g. a wildcard tenant-id policy plus a specific-table policy, or policies from two different roles), the predicates are combined (see "Combining policies").

### Kill switch (feature flag)

Row-level security ships **enabled by default**. Operators opt out by setting `quack-on-demand.rls.enabled = false` (or env `QOD_RLS_ENABLED=false`). When disabled, every statement bypasses the rewriter completely - no parse, no table walk, no per-statement overhead. Treat the toggle as a kill switch you can flip off in an incident: change the env var and restart the manager. It is independent of `QOD_CLS_ENABLED`; either feature can run without the other.

### Predicate validation

`predicate_sql` is validated once at policy create/update time and rejected (`400 invalid_policy`, with the violated rule named) when it:

1. Fails to parse as a single boolean SQL expression (after identity tokens are neutralised).
2. Contains a subquery or `EXISTS` - nesting a SELECT inside the predicate is refused.
3. Calls a side-effect or escape function: the denylist matches column-level security's - `read_csv`, `read_parquet`, `read_json`, `query`, `sql`, `attach`, `detach`, `install`, `load`, `system`, `current_setting`, `set_setting`, `pg_read_server_files`, `pg_read_binary_file`, and anything matching `pragma_*`.
4. Exceeds 1024 characters.

Detection runs on the parsed, canonicalised expression with string literals stripped, so a denylisted function nested inside any wrapper (`read_csv(...) IS NOT NULL`) is still caught, while a harmless literal like `note = 'select one'` is not mistaken for a subquery. Unlike a column mask transform, the predicate may reference *any* column of the protected table - it filters rows, so there is no single-column containment rule.

### Identity substitution tokens

Predicates may embed identity tokens that are filled from the principal's `EffectiveSet` at query time (never at authoring time - the stored predicate keeps the tokens). Each token expands to a complete SQL literal, so a single value is quoted and escaped and a list is rendered for `IN (…)`:

| Token | Expands to | Example expansion |
|---|---|---|
| `${user}`     | the username, quoted        | `'alice'` |
| `${tenant}` / `${tenantId}` | the principal's tenant id, quoted | `'acme'` |
| `${roles}`    | the effective role names as a quoted list | `'analyst', 'auditor'` |
| `${groups}`   | the effective group names as a quoted list | `'sales', 'eng'` |

Single-quotes in a value are doubled (`o'brien` → `'o''brien'`), so substitution is injection-safe. A **list token that resolves to the empty set becomes `NULL`**, so `dept IN (${groups})` becomes `dept IN (NULL)` - a predicate that matches no rows. This is the safe-restrictive default: a principal in no groups sees nothing through a group-keyed policy rather than erroring on `IN ()`.

Typical predicates:

| `predicate_sql` | Effect |
|---|---|
| `region = ${tenantId}`              | rows tagged with the caller's tenant |
| `owner = ${user}`                   | row-ownership |
| `dept IN (${groups})`               | rows for any of the caller's groups |
| `is_public OR owner = ${user}`      | public rows plus the caller's own |

### Combining policies

A principal sees a row if **any** matching policy admits it: predicates are combined with `OR` (permissive union). When role A filters `customer` by `region = 'eu'` and role B filters it by `tier = 'gold'`, a user holding both sees `WHERE (region = 'eu') OR (tier = 'gold')`. This makes additional roles strictly *widen* visibility, matching the additive nature of the rest of the RBAC model. A table with no matching policy for the principal is left unfiltered (the node decides whether the principal may read it at all).

### Interaction with column-level security

When both features are on, the row filter is injected inside the column rewrite, so rows are filtered on their true values and only the surviving rows are then masked for display. A row policy may safely key on a column that a column policy masks: the filter sees the real value (inside `(SELECT * FROM t WHERE …)`), the masking applies in the outer projection.

### Effective policies and caching

Row policies join column policies and the `RolePermission` / pool-permission rows in the per-user `EffectiveSet.rowPolicies`. The same 60-second `PoolSupervisor` cache covers them, and the same mutator-invalidation contract applies: `createRowPolicy`, `updateRowPolicy`, and `deleteRowPolicy` each call `invalidateEffectiveCache()`, so a freshly-authored policy takes effect on the next statement regardless of the TTL. Per-statement cost is in-memory only: an AST table-walk plus per-table lookup against the cached list - no Postgres traffic on the hot path.

### Observability

Two Micrometer metrics expose the rewriter's behaviour:

| Metric | Tags | Use |
|---|---|---|
| `row_policy_rewrites_total`          | `tenant`, `pool`, `outcome` ∈ `{rewritten, parse_failed, passthrough}` | Fraction of reads paying the rewrite cost; spot policy regressions. |
| `row_policy_rewrite_duration_seconds` | `tenant`, `pool` | Histogram of rewrite step wall time; alert on percentile regressions. |

The `outcome` tag emits:

- `rewritten`: at least one table was wrapped in a filtered subselect.
- `parse_failed`: the SQL could not be parsed; the original statement is forwarded unchanged. Distinct from `passthrough` so operators can tell "rewriter inactive because nothing to filter" from "rewriter gave up".
- `passthrough`: the rewriter inspected the SQL and decided no rewrite was needed (no covered table referenced; non-SELECT; superuser; user has no row policies; feature disabled).

### Authoring

Row policies are administered the same way as column policies: via REST endpoints under `/api/role/row-policy/{create,update,delete,list}`, via the admin UI's "Row policies" tab on the role detail page, and via YAML manifest (`rowPolicies` list under each role, each entry a `{catalog, schema, table, predicateSql}` object). The bundled demo manifest (`bootstrap-demo.yaml`) ships an example policy on `acme/analyst/customer` filtering to `c_mktsegment = 'BUILDING'`, so a fresh `LOAD_TPCH=1` boot demonstrates the feature end-to-end: the analyst sees only the ~30k BUILDING customers, a superuser sees all 150k. `scripts/bench/adbc.sh` is a quick way to diff the two.

## The two gates

Every statement, through any door, passes two gates.

### Gate 1: handshake (pool-access)

This is the database-access gate. Because each pool is bound to exactly one tenant-db (see "Pools and databases" above), admitting the pool admits its database. When a client opens a FlightSQL connection it supplies a tenant and pool name (via gRPC headers or JWT claims). The handshake:

1. Authenticates the credential (database bcrypt check, JWT validation, or OIDC; see the authentication page for details).
2. Resolves the user in `qodstate_user`.
3. Checks that the user's `effective_pools` covers the requested pool (or that `pool_id IS NULL` grants tenant-wide access).
4. Computes the `EffectiveSet` and binds it to the session.

If the user's effective pools do not include the requested pool, the handshake is rejected before any SQL is processed. Superusers skip step 3. The REST endpoints and MCP tools that run SQL go through the same gate as their caller.

### Gate 2: per-statement, on the node

Before each statement it sends a node, the manager installs a session handle on the node connection: a token naming the principal, the node, the pool, the policy version, a single-use nonce and a 60-second expiry, signed with that node's own key. The node (`qod-node`) refuses any statement on a connection with no current principal. For a principal who is not a superuser it describes the bound plan (objects with their access and columns, functions, settings, files) and asks the manager replica that minted the handle for a verdict. That replica applies the rules above against the session's `EffectiveSet` (or asks the tenant's OPA) and returns a signed allow or refuse.

- Verdicts are cached on the node for 60 seconds (an OPA tenant's for its OPA cache TTL) per principal, policy version and plan, and dropped as soon as the tenant's policy version moves. Sessions of one user with the same grants share verdicts; bearer-token sessions share them only within one token.
- Cost: a plan the node has not judged costs one call to the replica, about 0.7 to 0.9 ms; a fresh FlightSQL query makes two (its schema probe and the statement), about 1.4 ms end to end on one host. A cached verdict adds about 0.3 ms per statement.
- A refusal is a permission error: FlightSQL `UNAUTHORIZED`, reason `access denied: Permission Error: QoD: ...`, statement history status `denied`, a `data-denial` audit event.
- When no verdict can be had in time (the replica restarted, is down or unreachable from the node), the statement reads `QoD: authorization unavailable, retry`. A single statement is retryable (FlightSQL `UNAVAILABLE`); a multi-statement submission is not (`INVALID_ARGUMENT`, since the statements before the refused one may have run).

The node-side limits are `QOD_AUTHZ_DECIDE_TIMEOUT_MS` (1 to 60000) and `QOD_AUTHZ_CACHE_ENTRIES` (0 to 10000000), forwarded to every node; the decision metrics are on the [metrics reference](/qod/reference/metrics).

## Delegating to OPA

A tenant can hand its data-access decisions to its own Open Policy Agent server (`qod tenant set-acl <tenant> --mode opa --opa-url ...`; manager defaults `QOD_ACL_MODE`, `QOD_OPA_URL`, `QOD_OPA_TIMEOUT_MS`, `QOD_OPA_CACHE_TTL_SEC`). QoD grant tables are then ignored for that tenant; memberships are still sent as identity. Pool access is asked at handshake (rule `connect`); table and file access is asked by the node's verdict pipeline (rule `statement`) on what DuckDB resolved. The `statement` input carries `client.edge` `node`, each access with `catalog`, `schema`, `table`, `verb`, `kind` (`table`, `view`, `secure_view`, `schema`, ...), the `columns` read, `via` (the outermost secure view the access is read through, `null` otherwise) and, only when non-empty, `history` (any of `renamed`, `dropped`, `replaced`, on a DuckLake read at an earlier snapshot that crossed such a change of the table, named as described in [Earlier snapshots and the change feed](#earlier-snapshots-and-the-change-feed)), and the statement's `locations` (each file with its `access`, `location` and admitting `scope`). No input carries `statement.text` (`--send-statement-text` has no effect). **Existing Rego must handle `via`**, or reads through a secure view are judged as reads of the underlying table and denied. A policy that wants history kept to the current table can deny any access carrying `history`. On a `replaced` access the `columns` are the replaced table's column names as the statement read them, not its successor's, so a column rule keyed on the successor's names can misfire. Otherwise the input does not tell an earlier-snapshot or change-feed read of an unchanged table from a read of its current rows. The starter policy and the full input are in [examples/opa](https://github.com/starlake-ai/quack-on-demand/tree/main/examples/opa).

Only a literal `result.allow == true` allows. An OPA outage is `UNAVAILABLE` ("OPA unreachable or returned an error (see the manager log)"), never a permission error; the cause is only in the manager's WARN line. Everything QoD always refuses is refused before OPA is asked, and the catalog listings stay narrowed by QoD grants, so an OPA tenant with no QoD grants sees empty listings.

Dry-run a decision with `qod tenant opa-test <tenant> --pool <pool> --user <user>` (the `connect` rule) or with `--sql "<statement>"`: the statement then runs through a node of the pool as that user, is judged and never executed, and the command prints the exact input the node sent OPA and OPA's answer. It needs a running pool and never wakes one (`409 pool_not_running`), one statement (`400 single_statement_required`), an OPA tenant (`400 opa_mode_required`) and a tenant user (a superuser, or a statement QoD refuses first, is `400 refused_before_opa`); a statement with nothing to authorize is `400 nothing_to_authorize`, and a node that cannot reach the manager is `503 authz_unavailable`.

## Worked examples

These scenarios show how the entities, the EffectiveSet, and the two gates combine in practice. Each one lists the setup as entities plus grants, then the resulting allow/deny decision for representative statements. The grant notation `verb on catalog.schema.table` is one `qodstate_role_permission` row. For the REST and UI steps to create these, see the "Administering access" page; this section is about understanding the outcomes. The users, roles, groups, and grants shown match the bundled demo manifest at `src/main/resources/bootstrap-demo.yaml`, which is imported automatically when `LOAD_TPC=N` is set.

### Read-only analyst

A BI analyst may query a handful of curated TPC-H tables and nothing else.

Setup:

| Entity | Value |
|---|---|
| User | `alice` (tenant `acme`) |
| Role | `analyst` |
| Role permissions | `RO on acme_tpch.tpch1.customer`, `RO on acme_tpch.tpch1.orders`, `RO on acme_tpch.tpch1.nation`, `RO on acme_tpch.tpch1.region` |
| Pool grant | `alice` holds a direct pool permission for pool `bi` |
| Edge | `alice` assigned `analyst` directly (`qodstate_user_role`) |

Results, connecting to pool `bi` (default catalog `acme_tpch`, default schema `tpch1`):

| Statement | Decision | Why |
|---|---|---|
| `SELECT * FROM customer` | Allowed | Unqualified name resolves to `acme_tpch.tpch1.customer`; covered by `RO on acme_tpch.tpch1.customer`. |
| `SELECT * FROM lineitem` | Denied | Resolves to `acme_tpch.tpch1.lineitem`; no grant on `lineitem` exists for `analyst`. |
| `INSERT INTO customer VALUES (...)` | Denied | Write access needs `RW` or `ALL`; `analyst` holds only `RO` on `customer`. |

### ETL pipeline through a group

A data-engineering account runs nightly loads. Permissions are attached to roles, the roles to a group, and the account to the group, so onboarding a second loader is one group-membership change.

Setup:

| Entity | Value |
|---|---|
| User | `bob` (tenant `acme`) |
| Group | `data-eng` |
| Roles via group | `etl` and `dba` (`qodstate_group_role`) |
| `etl` permissions | `RW on acme_tpch.tpch1.lineitem`, `RO on acme_tpch.tpch1.orders` |
| `dba` permissions | `DDL on acme_tpch.tpch1.*` |
| Edge | `bob` is a member of `data-eng` (`qodstate_user_group`) |
| Pool grant | `bob` holds a direct pool permission for pool `etl` |

Results, connecting to pool `etl` (default catalog `acme_tpch`, default schema `tpch1`):

| Statement | Decision | Why |
|---|---|---|
| `INSERT INTO lineitem SELECT * FROM orders` | Allowed | Write target `acme_tpch.tpch1.lineitem` covered by `RW on acme_tpch.tpch1.lineitem` (via `etl`); read source `acme_tpch.tpch1.orders` covered by `RO on acme_tpch.tpch1.orders` (via `etl`). Both sides must pass. |
| `DELETE FROM lineitem WHERE l_orderkey < 0` | Allowed | DELETE is a `Write` access on `acme_tpch.tpch1.lineitem`, covered by `RW on acme_tpch.tpch1.lineitem`. |
| `CREATE TABLE foo (id INT)` | Allowed | `CREATE` is a `Ddl` access on `acme_tpch.tpch1.foo`; covered by `DDL on acme_tpch.tpch1.*` (via `dba`). |
| `SELECT * FROM customer` | Denied | Resolves to `acme_tpch.tpch1.customer`; neither `etl` nor `dba` grants `RO` (or broader) on `customer`. |

`RW` on a table covers both reads and writes on that table; if the workload needs to write somewhere but read from elsewhere, add the matching read grant separately as in the example above.

### Cross-tenant denial via wildcard scope

A tenant administrator holds `ALL on *.*.*` inside their tenant. The catalog `*` wildcard is scoped to the session's tenant, so it does not reach a sibling tenant's catalog.

Setup:

| Entity | Value |
|---|---|
| User | `acme-admin` (tenant `acme`, not a superuser) |
| Role | `tenant_admin` |
| Role permission | `ALL on *.*.*` |
| Pool grants | pool `bi` and pool `etl` (both in tenant `acme`) |

Results, connecting to pool `bi`:

| Statement | Decision | Why |
|---|---|---|
| `SELECT * FROM customer` | Allowed | Resolves to `acme_tpch.tpch1.customer`; `ALL` covers `Read` and `*` matches any catalog within tenant `acme`. |
| `CREATE TABLE tpch1.new_table (id INT)` | Allowed | `ALL` covers `Ddl`; the wildcard matches `acme_tpch`. |
| `SELECT * FROM globex_tpcds.tpcds1.store_sales` | Denied | `globex_tpcds` belongs to tenant `globex`, not `acme`; the catalog `*` wildcard is scoped to the session's tenant and does not match it (and the `bi` pool's nodes do not attach it at all). |

The same scoping keeps the wildcard off a federated catalog the pool attaches: to let the admin read one, grant it by its alias (`RO on pgsrc.*.*`). Contrast with a superuser (`tenant IS NULL`), whose statements the node allows without a grant check.

### Pool gate versus statement gate

Table permissions and pool access are independent. Holding the right table grants does not let a user onto a pool they were never granted.

Setup:

| Entity | Value |
|---|---|
| User | `alice` (tenant `acme`) with role `analyst` granting `RO on acme_tpch.tpch1.customer` (and others) |
| Pool grant | a pool permission for pool `bi` only |

Results:

| Action | Decision | Why |
|---|---|---|
| Connect to pool `bi`, then `SELECT * FROM customer` | Allowed | Gate 1 admits the pool; the node's verdict admits the read (`acme_tpch.tpch1.customer` covered by `RO`). |
| Connect to pool `etl` | Denied at handshake | Gate 1: `alice`'s effective pools do not include `etl`. No SQL is ever evaluated. |

A pool permission with a null `pool_id` would admit `alice` to every pool in tenant `acme`, collapsing the two rows above into one tenant-wide grant.

## Privilege-escalation guards

The following invariants are enforced at the API layer, not by the database schema alone:

- Only a superuser (`tenant IS NULL`) can create another superuser. A tenant-scoped admin attempting to create a user with `tenant IS NULL` is rejected.
- When granting a role permission, the granting principal must themselves hold that permission (or a covering wildcard) in their own effective set. A tenant-scoped admin cannot grant more than they hold.
- These checks apply to every mutation path: REST API, and any admin seeding at startup.

Superusers are not subject to these guards because they bypass the effective-set check entirely.

## Upgrading to the built-in RBAC release

The release that introduces the built-in roles and groups also renames the user column `qodstate_user.role` to `kind`. Plan the upgrade as follows:

- **Stop every manager replica, then start them all on the new version.** There is no rolling upgrade across this release: once the schema migration renames the column, a replica still on the previous version can no longer authenticate anyone.
- **Rename `role` to `kind` everywhere you set the account kind**: REST `user/create`, `user/update` and `user/list` carry `kind` (a request still sending `role` is refused with `400`), the CLI takes `qod user create/update --kind admin|user` (`qod user create --role` now names an RBAC role to attach), the MCP `create_user` / `update_user` tools take `kind`, and a manifest user entry uses the key `kind` (the old key is refused). The SQL dialect is unchanged (`CREATE USER ... ADMIN`).
- **Rename the boot setting** `QOD_ADMIN_ROLE` (`quack-on-demand.admin.role`) to `QOD_ADMIN_KIND` (`quack-on-demand.admin.kind`); the old variable is ignored.
- **Update custom authentication queries**: a `QOD_AUTH_DB_SYSTEM_QUERY` or `QOD_AUTH_DB_TENANT_QUERY` must select `password_hash, kind, enabled, must_change_password`, or boot fails.
- **Rename user-made `qod_` roles and groups** left from before the prefix was reserved (including backfill-renamed `<name>_renamed` rows): while any exists, manifest export answers `400 reserved_name` and lists them.

The session JWT `role` claim and the login and whoami responses are unchanged.
