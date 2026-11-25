---
id: rbac-model
title: "Access control model: RBAC, row and column security for DuckDB"
sidebar_label: "Access control model"
description: "The role-based access control model enforced on every DuckDB statement: roles, groups, table verbs, row-level policies, column masking, two gates."
keywords: ["duckdb rbac", "duckdb access control", "row-level security", "column masking", "duckdb acl", "permissions"]
---

This page describes the role-based access control (RBAC) model QoD enforces on every statement, whichever door it arrives through (FlightSQL, the native Quack front door, MCP or a REST endpoint that runs SQL). It covers the data model, how effective permissions are computed, what the node checks on each statement, and where superusers fit. For step-by-step instructions on creating users, roles, groups, and grants, see the "Administering access" page, or [Administer with SQL](/qod/administration/sql-administration) to do the same from any connected SQL client.

Enforcement is always on. Since 0.11.0 the node that runs a statement decides it, on the plan DuckDB bound, and there is no switch to turn it off: `QOD_ACL_ENABLED`, `QOD_ACL_FILTERED_METADATA` and `QOD_ACL_DIALECT` were removed, and a manager that still sets one refuses to start (see [Upgrading to 0.11.0](../upgrading/to-0-11.md)).

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
| `qodstate_user` | One row per principal. Tenant-scoped users carry a non-null `tenant` value; a row with `tenant IS NULL` and kind `admin` is a superuser, and one with `tenant IS NULL` and kind `staff` is a [platform staff user](./platform-staff.md). On a tenant row the `kind` column (`admin` or `user`) is the management-rights flag (admin console and REST administration); it is not an RBAC role and grants no table or pool access. |
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

The handshake produces an `AuthorizedHandshake` that carries the resolved `PoolKey`, the matched user row, and the full `EffectiveSet`. The gateway keeps it with the session: the replica that answers the node's verdict requests judges with it, and the column and row policies it holds are what the manager signs into the session handle for the node to enforce.

### Revocation and the policy version

Every tenant carries a policy version (`qodstate_tenant.policy_version`), bumped by any change to its users, roles, role permissions, groups, memberships, pool permissions, row and column policies, ACL mode, OPA settings, authorized folders and users' S3 keys; a change to any database's data folder moves every tenant's version. Before a statement runs, a session whose tenant moved past the version its set was resolved under runs the handshake's gates again. A revoke therefore reaches open FlightSQL and native sessions on their next statement (inside an open native transaction too, which it ends: `transaction aborted: <reason>; ROLLBACK to continue`), and a re-grant restores them without a reconnect. A user disabled, deleted or removed from the pool is refused on the next statement; a control-plane outage during that check is a retryable `UNAVAILABLE`.

## Superusers

A user with `tenant IS NULL` and kind `admin` in `qodstate_user` is a superuser. Superusers bypass both gates:

- The pool-access gate at handshake (they may connect to any pool in any tenant).
- The per-statement gate: the node still describes their statements (the audit log gets the real objects) but allows them without checking `effective_perms`.

A few mechanism rules still bind superusers: writes, DDL, `ATTACH` and `DETACH` against a [read-only federated catalog](./federation.md) are refused to every principal, and so is changing the optimizer and Quack authorization settings (`QoD: <name> cannot be changed`).

A superuser is a row with no tenant whose kind is `admin`. Every door to data binds a tenant-less row only when its kind is `admin`, and refuses any other (a superuser demoted to `user`, a [staff user](./platform-staff.md)) as an unknown user, logging the reason at WARN. A superuser session already open when its row is demoted, disabled or deleted is refused on its next statement. The bootstrap admins seeded at startup are superusers: their kind is `QOD_ADMIN_KIND`, which must be `admin` (boot refuses any other value). `qod user create --superuser` creates kind `admin`. Only superusers can create other superusers; the API enforces this constraint at the application layer.

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

Literal values compare as DuckDB binds names: ASCII letters fold case (`Orders` matches `orders`), other letters do not, so `"Clés"` and `"clÉs"` are two tables and a grant on one never covers the other. Column and row policies match the same way. Boot prints one stderr `WARN:` line for each stored grant, column policy or row policy whose names hold a non-ASCII letter with another case, as such a row matches only an object spelled with exactly those letters. `*` matches exactly.

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

Every function and setting a statement calls must be classified. A function the classification does not list (a misspelled one included) reads `QoD: function <name> is not classified`; so does a macro a superuser created, until it is called as `system.main.<name>` or classified. A view, generated column, column default, CHECK constraint or trigger that calls such a function, a user macro, or a `query()` with a computed argument makes its table or view unreadable (or unwritable) for tenant users, and so do views nested more than 16 deep. Literal `query('<sql>')` and `query_table('<name>')` are admitted and judged on what they bind. `SET` / `RESET` of a session setting (`TimeZone`, `search_path`, `schema`, `SET VARIABLE`, ...) is admitted; node-wide, credential and I/O settings are superuser-only (see [Hardening](./hardening.md#node-enforcement-always-on)). A principal holding a row policy cannot read the tables it covers while such a session setting other than `schema` / `search_path` is changed ([When a row policy cannot be applied](#when-a-row-policy-cannot-be-applied)). `BEGIN`, `COMMIT`, `ROLLBACK` and `USE` need no grant.

Tenant users are always refused, whatever their grants: `CREATE MACRO`, trigger DDL, `CREATE` / `DROP SECRET`, `ATTACH`, `IMPORT` / `EXPORT DATABASE`, `CONNECT`, extension `INSTALL` / `LOAD`, `DESCRIBE (<query>)` / `SUMMARIZE (<query>)`, a PRAGMA off a read-only list, `current_setting()`, `pg_get_viewdef`, `duckdb_memory()`, and the catalog-wide listings nothing filters yet (`duckdb_constraints()`, `duckdb_indexes()`, `duckdb_sequences()`, `duckdb_triggers()`, `duckdb_types()`, `duckdb_functions()`, `duckdb_dependencies()`). A plan the node cannot describe is refused to every principal (`statement uses <X>, which QoD does not support`); there is no `*.*.* ALL` escape.

### Catalog listings

A tenant user's catalog listings are always narrowed to the objects they are granted: `information_schema.schemata`, `tables`, `columns` and `views`, named so in the statement itself, and `duckdb_schemas()`, `duckdb_tables()`, `duckdb_views()` and `duckdb_columns()`. Each grant is pinned to the catalog it covers, so a grant on `lake.main.*` does not list another attached catalog's `main`, a grant naming a federated catalog (`pgsrc.public.*`) lists that catalog's objects, and a wildcard catalog lists the pool's own catalog only. An `RO` grant on `information_schema` gives a principal unfiltered listings.

The filter replaces such a read with one of its own, so for a user whose listings are filtered a clause it cannot keep is refused: a sample (`TABLESAMPLE`, `USING SAMPLE`), a `PIVOT` or `UNPIVOT`, or `WITH ORDINALITY` on `information_schema.tables` (and its other filtered views) or on a `duckdb_*()` catalog function. A subquery works around the sample and the pivot: `FROM (SELECT * FROM information_schema.tables) USING SAMPLE 10%`.

DuckDB's other built-in listing views are refused to every non-superuser, however they are named or nested (bare, `pg_catalog.` or `system.`, in a subquery, a CTE, a `query()` string or a view body): `pg_catalog`'s views (`pg_tables`, `pg_views`, `pg_attribute`, ...), `sqlite_master`, the parenless `duckdb_tables` / `duckdb_views`, `system.information_schema.*`, bare `SHOW` and `DESCRIBE`, `SHOW TABLES FROM ...`, `SHOW SCHEMAS`, `SHOW DATABASES` and `SHOW VARIABLES` (`SELECT * FROM duckdb_variables()` lists the session's variables instead). A grant covering them, `*.*.*` included, does not admit them. The gateway answers a top-level `SHOW TABLES` / `SHOW ALL TABLES`, `DESCRIBE <table>`, `SHOW <table>`, `PRAGMA table_info('<table>')` and `SUMMARIZE <table>` from the filtered listings plus a read of the object, so they need a read grant on it (DESCRIBE's `key` and table_info's `pk` come back NULL; on an OPA tenant these answers are empty and SUMMARIZE is refused).

### Files

A tenant user reads or writes a file by path only through a file reader or `COPY`, and only under an S3 scope they registered keys of their own for, or a local folder their tenant authorized; never a database data folder. A `COPY t FROM` is a write to `t`, a `COPY ... TO` reads what its query reads. A location computed from constants (`read_csv('s3://b/in/' || strftime(today(), '%Y%m%d') || '.csv')`) is evaluated by the node as the user and judged as the literal it yields. See [Hardening](./hardening.md#files-and-s3).

### Earlier snapshots and the change feed

A DuckLake table read at an earlier snapshot (`AT (VERSION => n)`, `AT (TIMESTAMP => ...)`) or through DuckLake's change feed is judged by the table's DuckLake id: as the table that id names now, under its current name and columns, whatever name the statement wrote. That covers time travel, the data diff, branch change counts, the restore dry run and undrop.

- **Renamed since:** judged as the table it is now, on its current name's grant. A grant on a table that later took the old name does not cover it.
- **Replaced since** (`CREATE OR REPLACE`, a QoD restore): the same table, so its history is judged on the current name's grant.
- **Dropped since:** judged as a read of its last live name, allowed while no live table or view holds that name and the grant covers it. Once the name is reused, only a superuser reads it.
- **Users with column or row policies** read a table at a snapshot only when its name has always named that same table, with the same column names, in every snapshot the catalog holds, and never named a view. The policies match today's names while a snapshot read binds its own, so only then are the masks and row filters sure to hit the right table and columns. A table renamed, dropped or recreated since, or with a column renamed or dropped, is refused on every door until those snapshots expire: `<table>, or one of its columns, was renamed, dropped or recreated in the history the catalog holds; under a column or row policy it cannot be read with time travel`. The change feed stays refused to them (below).

A `TIMESTAMP` is resolved in the client's `TimeZone`. A dropped table read `AT (TIMESTAMP => ...)` can be refused when the node cannot pin the timestamp to the same snapshot DuckLake reads (sub-microsecond rounding, a session `TimeZone` it cannot apply): read it `AT (VERSION => n)` instead, which is never affected.

DuckLake's change feed, `ducklake_table_changes`, `ducklake_table_insertions` and `ducklake_table_deletions`, is admitted to tenant users as a read of the table it names, which it must name by literals (`QoD: ... needs its catalog, schema and table as literals, and its two snapshot bounds` otherwise). Its change rows cannot be masked or filtered, so it stays refused to a user with any column or row policy. Superusers read either without a grant check, as everything else.

## Column-level policies

The table-level ACL described above is "all-or-nothing" per table: once a role has `RO` on `customer`, every column on `customer` is readable. Many regulated workloads (GDPR, HIPAA, PCI) need finer control: a role may read `customer` but `c_ssn` is forbidden, or `c_email` is returned as `'***'` instead of the raw value. Column policies enforce these patterns on the node that runs the statement, on the plan DuckDB bound for it, so they hold however the statement names the column.

### Data model

Policies live in `qodstate_role_column_policy` (one row per `(role, catalog, schema, table, column)`) and attach to roles only; users inherit them through the same role-membership graph as table permissions.

| Column | Meaning |
|---|---|
| `role_id`        | The role that carries the policy. |
| `catalog_name` / `schema_name` / `table_name` | The protected base table. `*` wildcards work the same way as for table permissions, including tenant scoping on `catalog_name`. |
| `column_name`    | The protected column. **Always literal - `*` is rejected.** A wildcard column policy would mean "deny everything", which is already expressible via absence of a table-level grant. |
| `action`         | `deny` (refuse any statement that reads the column) or `mask` (return a transformed value). |
| `transform_sql`  | The mask expression. `NULL` for `deny`; for `mask`, an expression over the protected column written in the [allowed mask forms](#allowed-mask-forms). |

`UNIQUE (role_id, catalog_name, schema_name, table_name, column_name)` so updates replace in place. `ON DELETE CASCADE from qodstate_role` so dropping a role drops its policies.

### How a column policy is applied

The manager signs the principal's column and row policies into a policy snapshot that the session handle names. A node that does not hold that snapshot yet fetches it from the replica that minted the handle (`POST /api/internal/authz/policies`, on the verdict listener described in [Node keys and the decide URL](./hardening.md#node-keys-and-the-decide-url)) and verifies its signature before installing it. A node that cannot fetch a complete, valid snapshot runs nothing for the user: the statement reads `QoD: policy snapshot unavailable; retry`; run it again.

When DuckDB binds a statement, the node puts a masking step directly above every scan of a covered table, wherever the scan sits: in the statement itself, a plain or secure view, a CTE, a derived table, either side of a join, a subquery or a set operation. Everything the statement computes reads the masked value:

- Every reference reads the mask: the select list, `WHERE`, `JOIN ... ON`, `USING` and `NATURAL` joins, `GROUP BY`, `HAVING`, `ORDER BY`, aggregates, window functions, `SELECT *` and `t.*`, positional references (`#3`) and whole-row values (`SELECT c FROM customer c`). A predicate on a masked column compares the masked value: with `c_email` masked as `'***'`, `WHERE c_email LIKE '%@acme.com'` matches no row.
- A view or derived table that reads the column passes the masked value on; nothing is masked twice.
- Result column names are the ones DuckDB gives the statement for any principal: an unaliased `upper(c_email)` is named `upper(c_email)`, and no name carries the mask. `EXPLAIN` shows the policy step without its expression.
- A mask runs under `TRY`: a row on which it fails to evaluate reads NULL, so no error quotes the raw value.

Superusers, and the statements the manager runs as itself, carry no column policies.

### Allowed mask forms

`transform_sql` is validated when a policy is created or updated (REST, CLI, MCP, the admin UI, SQL `CREATE COLUMN POLICY`) and when a manifest is imported, before the import writes any row. A refused mask answers `400 invalid_policy`, naming the rule it breaks or each part that is not allowed, never the whole mask. The expression must:

1. Parse whole as one scalar expression (a token the parser cannot read, a comment, or a `;` is refused).
2. Read only the protected column. Another column, a star, `COLUMNS(...)` or a statement parameter is refused.
3. Hold no subquery or `EXISTS`.
4. Be at most 1024 characters in canonical form.
5. Use only these forms, `<x>` being any allowed form:
   - string and numeric constants, `NULL`, `TRUE`, `FALSE`, the column itself;
   - `<x> || <x>` and `concat(<x>, ...)`;
   - `CAST(<x> AS VARCHAR)`, `TRY_CAST(<x> AS VARCHAR)`, `<x>::VARCHAR` (also `TEXT` or `STRING`), and `hash(<x>, ...)`;
   - a subscript or slice (`<x>[1]`, `<x>[1:3]`, `<x>['k']`) whose indexes, bounds and steps are constants;
   - `upper`, `lower`, `trim`, `ltrim`, `rtrim`, `left`, `right`, `substr`, `substring`, `lpad`, `rpad` and `regexp_replace` over `<x>` with constant arguments;
   - `md5`, `sha1`, `sha256` and `length` over text only: write `CAST(<column> AS VARCHAR)` first (`md5(c_email)` is refused, `md5(CAST(c_email AS VARCHAR))` is not);
   - `coalesce(<x>, ...)`, `CASE WHEN <x> IS [NOT] NULL THEN ... [ELSE ...] END` and `nullif(<x>, <string constant or NULL>)`;
   - DOUBLE arithmetic: `TRY_CAST(<x> AS DOUBLE)`, `/` by a nonzero constant, `%` by a positive integer constant, `round`, `floor`, `ceil`, and `+`, `-`, `*` over those and numeric constants;
   - `TRY_CAST(<x> AS <type>)` to an integer type (`TINYINT` to `HUGEINT`, `UTINYINT` to `UHUGEINT`), `FLOAT`, `DECIMAL(p, s)`, `BOOLEAN`, `DATE`, `TIME`, `TIMETZ`, `TIMESTAMP` (and `TIMESTAMP_S`, `TIMESTAMP_MS`, `TIMESTAMP_NS`, `TIMESTAMPTZ`), `INTERVAL`, `UUID` or `BLOB`, where `<x>` is a DOUBLE result, a text form, `length` / `hash` or a constant, never the bare column or a form of unknown type: this is how a mask over a column that is neither text nor `DOUBLE` gets its column's type (see [The mask keeps the column's type](#the-mask-keeps-the-columns-type)).

   Function names are written plain, never quoted or qualified. Anything else is refused: `TRY(...)`, a comparison, a boolean operator, `AT TIME ZONE`, any other cast (`CAST(<x> AS INTEGER)`, `TRY_CAST(<column> AS INTEGER)`), a subscript with a computed index, and a number or digest function over the bare column. The list keeps to forms whose evaluation cannot fail with an error quoting the value it failed on, over a column of any type.

### The mask keeps the column's type

The node binds each mask on its own, against the protected column alone, and the result must have exactly the column's type. Only a literal `NULL` is converted, so `NULL` fits a column of any type. A mask whose result has another type is refused whenever its column is read: `QoD: column mask cannot be applied safely with its original column type`. So:

- **Text masks fit `VARCHAR` columns**: `'***'`, `left(c_email, 2) || '***'`, `md5(CAST(c_email AS VARCHAR))`, `concat('user_', ...)`. `hash(c_email)` returns a `UBIGINT` and does not fit.
- **DOUBLE arithmetic fits `DOUBLE` columns**: `round(TRY_CAST(salary AS DOUBLE) / 1000) * 1000` on a `DOUBLE` column.
- **On a column of any other type, end the mask with `TRY_CAST` to that type**: `TRY_CAST(round(TRY_CAST(salary AS DOUBLE) / 1000) * 1000 AS INTEGER)` on an `INTEGER` column, `TRY_CAST(round(TRY_CAST(amount AS DOUBLE)) AS DECIMAL(10, 2))` on a `DECIMAL(10,2)` one, `TRY_CAST(left(CAST(born AS VARCHAR), 4) || '-01-01' AS DATE)` (the year only) on a `DATE` one. `NULL`, a constant of exactly that type and a `deny` fit as well.

A create or an update of a mask whose result does not have its column's type is refused (`400 invalid_policy`, naming the column, both types and the `TRY_CAST` form to use) wherever the tenant's DuckLake databases hold the table its policy names. It is accepted when that cannot be checked: the table does not exist yet, the policy names its schema, table or column by a wildcard, the column has a nested type, or the catalog cannot be read. A manifest import is not checked, so a backup always restores. At each boot the manager prints one `WARN:` line on stderr for each stored mask and database where the types differ, naming the tenant, the role, the policy id, the column and both types, never the mask.

The same refusal answers a mask that, once bound, holds a subquery, a parameter, a lambda or a window, reads any column but its own, or reaches anything but DuckDB's own functions classed allowed (a macro, `getvariable`, `current_setting`), and a read while the session has set `default_collation`, `integer_division`, `ieee_floating_point_ops` or `lambda_syntax`; `RESET` the setting to read the table again.

Typical valid masks on `VARCHAR` columns:

| `transform_sql` | Meaning |
|---|---|
| `'***'`                                           | constant string |
| `NULL`                                             | scrub to NULL (any column type) |
| `md5(CAST(c_email AS VARCHAR))`                    | hash |
| `concat('user_', md5(CAST(c_email AS VARCHAR)))`   | prefix + hash |
| `regexp_replace(c_phone, '[0-9]', 'X', 'g')`       | character substitution |
| `concat('****', right(c_phone, 4))`                | last-4 reveal |

### Action: deny

A `deny` policy refuses a statement whose plan reads the column, in any clause: `QoD: access to a column is denied by a column policy`. `SELECT *` over the table is refused rather than silently dropping the column, and so is a view or CTE that projects the column even when the outer query selects another one. A statement that does not read it (other columns, `count(*)`) runs. A row policy's predicate on the same table still reads a denied column, out of the caller's sight.

### Several policies on one column

When several of a principal's column policies cover the same column, a `deny` wins, then a policy naming the table wins over a table-wildcard one. Two different masks left covering the column refuse the read with `QoD: conflicting column masks`: give the column one mask, or a deny. A wildcard keeps its own scope: a policy on `*.sales.*` never reaches a table of another schema.

### What a column policy cannot cover

- **Base tables only.** A policy whose table names a view or a user table macro refuses reads of it (`QoD: statement uses a column policy scoped to a view; scope it to its base tables instead, which QoD does not support`): put it on the base table, which protects every view over it. A wildcard table matches base tables, never views.
- **Generated columns.** A policy naming a generated column refuses reads of its table (`QoD: native CLS does not support policies on generated columns; protect their source columns instead`). A policy on a column the generated expression reads applies before the expression runs.
- **Unusual scan shapes** (a scan DuckDB already narrowed or one reading nested fields directly) are refused with `QoD: column mask cannot be applied safely with its original column type` rather than read unmasked.
- **Writes, DDL and the change feed**: see [Writes and DDL under column or row policies](#writes-and-ddl-under-column-or-row-policies) and [Earlier snapshots and the change feed](#earlier-snapshots-and-the-change-feed).

### Authoring

Column policies are administered the same way as table permissions: via REST endpoints under `/api/role/column-policy/{create,update,delete,list}`, via the admin UI's "Column policies" tab on the role detail page, via SQL ([Administer with SQL](../administration/sql-administration.md)), and via YAML manifest (`columnPolicies` list under each role). The bundled demo manifest (`bootstrap-demo.yaml`) ships an example mask policy on `acme/analyst/customer.c_phone` so a fresh `LOAD_TPCH=1` boot demonstrates the feature end-to-end without manual setup.

## Row-level policies

Column policies restrict *which columns* a role sees; row policies restrict *which rows*. Where column-level security blanks out `c_ssn`, row-level security drops the customer records a role is not allowed to see in the first place - a salesperson sees only their own region's orders, a tenant analyst sees only rows tagged with their tenant id, an auditor sees everything. Like column policies, row policies are enforced by the node on the plan DuckDB bound: the node adds a filter at every scan of a covered table.

### Data model

Policies live in `qodstate_role_row_policy` (one row per `(role, catalog, schema, table)`) and attach to roles only; users inherit them through the same role-membership graph as table permissions.

| Column | Meaning |
|---|---|
| `role_id`        | The role that carries the policy. |
| `catalog_name` / `schema_name` / `table_name` | The protected base table. `*` wildcards work the same way as for table permissions, including tenant scoping on `catalog_name`. A `table_name = '*'` policy filters every base table of the schemas it covers - useful for a tenant-id predicate that should apply everywhere. |
| `predicate_sql`  | A boolean SQL expression that admits a row when it evaluates true. May embed identity-substitution tokens (see below). Validated at create time. |

`UNIQUE (role_id, catalog_name, schema_name, table_name)` so updates replace in place; a role carries at most one predicate per exact table tuple (a wildcard policy and a specific-table policy are different tuples and both apply). `ON DELETE CASCADE from qodstate_role` so dropping a role drops its policies.

### How a row policy is applied

The manager fills each predicate's identity tokens for the principal and signs the result into the same policy snapshot as the column policies. When DuckDB binds a statement, the node finds every scan of a covered base table, wherever it sits (the statement itself, a plain or secure view, a CTE, a derived table, either side of a join, a subquery, a set operation, a literal `query('<sql>')` or `query_table('<name>')`), and puts a filter directly on it.

- The predicate is parsed and bound on its own, against the scanned table only. A column name the table does not have can never bind to another table of the statement: the read is refused instead.
- Filtering at the scan keeps the filter correct under joins (each table filters independently), aggregation (rows are dropped before `GROUP BY`), `LIMIT`, `DISTINCT`, samples, `PIVOT` and set operations, and for projections that do not select the predicate's columns. Time travel (`AT (VERSION => n)`) reads the snapshot it names, filtered, under the rule of [Earlier snapshots and the change feed](#earlier-snapshots-and-the-change-feed). This matches Postgres RLS and Snowflake row-access policies, where the predicate is a property of the table scan.
- The filter is an optimizer boundary: a caller's predicate that can raise an error is not evaluated on hidden rows first, and statistics of hidden rows do not show as column statistics.
- Each policy evaluates as `TRY(CAST(predicate AS BOOLEAN))`. A row on which a predicate errors or yields NULL is not admitted by that policy; another policy can still admit it.

Tables are matched by name as DuckDB compares them, with the `*` wildcards. Superusers, and the statements the manager runs as itself, are not filtered.

### Predicate validation

`predicate_sql` is validated when a policy is created or updated and when a manifest is imported, before the import writes any row, and refused (`400 invalid_policy`, with the violated rule named) when it:

1. Does not parse whole as a single boolean expression (a token the parser cannot read, a comment, or a `;` is refused).
2. Holds an identity token other than the five below, or one that is not a complete SQL value (inside a string literal or a quoted identifier, or glued to a name).
3. Contains a subquery or `EXISTS`, a lambda, or a window function.
4. Calls a function that is not one of DuckDB's own functions classified as allowed (written plain or as `system.main.<name>`), or one of `getvariable`, `current_setting`, `random`, `uuid`, `uuidv4`, `uuidv7`, `nextval`, `currval`, or a side-effect or escape function (`read_csv`, `read_parquet`, `read_json`, `query`, `sql`, `attach`, `detach`, `install`, `load`, `system`, `set_setting`, `pg_read_server_files`, `pg_read_binary_file`, anything matching `pragma_*`).
5. Exceeds 1024 characters.

The predicate may reference *any* column of the protected table: it filters rows, so there is no single-column containment rule.

### Identity substitution tokens

Predicates may embed identity tokens that are filled from the principal's `EffectiveSet` at query time (never at authoring time - the stored predicate keeps the tokens). Each token expands to a complete SQL literal, so a single value is quoted and escaped and a list is rendered for `IN (…)`:

| Token | Expands to | Example expansion |
|---|---|---|
| `${user}`     | the username, quoted        | `'alice'` |
| `${tenant}` / `${tenantId}` | the principal's tenant id, quoted | `'acme'` |
| `${roles}`    | the effective role names as a quoted list | `'analyst', 'auditor'` |
| `${groups}`   | the effective group names as a quoted list | `'sales', 'eng'` |

Single-quotes in a value are doubled (`o'brien` → `'o''brien'`), so substitution is injection-safe. A **list token that resolves to the empty set becomes `NULL`**, so `dept IN (${groups})` becomes `dept IN (NULL)` - a predicate that matches no rows. This is the safe-restrictive default: a principal in no groups sees nothing through a group-keyed policy rather than erroring on `IN ()`. A predicate whose expansion exceeds 64 KiB denies the reads of its table for that principal.

Typical predicates:

| `predicate_sql` | Effect |
|---|---|
| `region = ${tenantId}`              | rows tagged with the caller's tenant |
| `owner = ${user}`                   | row-ownership |
| `dept IN (${groups})`               | rows for any of the caller's groups |
| `is_public OR owner = ${user}`      | public rows plus the caller's own |

### Combining policies

A principal sees a row if **any** matching policy admits it: predicates are combined with `OR` (permissive union). When role A filters `customer` by `region = 'eu'` and role B filters it by `tier = 'gold'`, a user holding both sees the rows where `(region = 'eu') OR (tier = 'gold')`. This makes additional roles strictly *widen* visibility, matching the additive nature of the rest of the RBAC model. A table with no matching policy for the principal is left unfiltered (the node decides whether the principal may read it at all): a row policy never turns a table grant into default-deny.

### When a row policy cannot be applied

A statement reading a covered table is refused, rather than read unfiltered, with `QoD: row policy could not be bound to its table` when:

- the predicate names a column the table does not have (dropped or renamed since the policy was written), or calls something that does not resolve to an allowed built-in function;
- the stored predicate no longer passes validation, or its expansion exceeds 64 KiB;
- the session has set a default collation, or any session setting other than `schema` / `search_path`: a `SET TimeZone` (which some clients send on connect) included. `RESET` the setting to read the table again.

The refusal names neither the policy, the predicate, the identity values nor the column. The node logs each one as a `QoD row policy refusal` line with the policy id, the table and the cause, the manager logs a stored predicate it cannot use at ERROR (`row policy refused: tenant=... policy=... table=... cause=...`), and `qod_node_authz_row_policy_refusals_total` counts them per node ([metrics](../reference/metrics.md#authorization-metrics)).

Also refused for a principal with a row policy on a table it reads:

- **A policy scoped to a view**: reads of that view, nested ones included (`QoD: statement uses a row policy scoped to a view; scope it to its base tables instead, which QoD does not support`). Put the policy on the base table. Wildcard policies apply to base tables, never to a view's columns.
- **`EXPLAIN` and `EXPLAIN ANALYZE`** of a statement scanning the table (`QoD: EXPLAIN of a row-policy table exposes protected estimates`): their row estimates and profiles count hidden rows.

### Interaction with column-level security

When both apply to a table, the node places the row filter on the raw scan and the masking step above it: predicates read the true values, and only the surviving rows are then masked for the caller. A row policy may therefore key on a column that a column policy masks or denies; columns the scan reads only for the predicate are not added to the result.

### Authoring

Row policies are administered the same way as column policies: via REST endpoints under `/api/role/row-policy/{create,update,delete,list}`, via the admin UI's "Row policies" tab on the role detail page, via SQL, and via YAML manifest (`rowPolicies` list under each role, each entry a `{catalog, schema, table, predicateSql}` object). The bundled demo manifest (`bootstrap-demo.yaml`) ships an example policy on `acme/analyst/customer` filtering to `c_mktsegment = 'BUILDING'`, so a fresh `LOAD_TPCH=1` boot demonstrates the feature end-to-end: the analyst sees only the BUILDING customers, a superuser sees all of them. `scripts/bench/adbc.sh` is a quick way to diff the two.

## Policy holders

The rules in this section apply to a principal holding at least one column or row policy, whatever table it names. Superusers and the manager's own statements are never treated as policy holders.

### Writes and DDL under column or row policies

Column and row policies protect reads only; there are no write-check policies. So, for a principal holding a policy on a table:

- **Writes to it are refused**, `INSERT` included, and `UPDATE`, `DELETE`, `MERGE`, `TRUNCATE`, upserts and `COPY ... FROM`: `QoD: writes to a row-policy table require write-check policies, which node RLS does not yet support`, or `QoD: writes to a column-policy table are not supported in native CLS`. The gateway refuses some of them first, with `access denied: <table> is protected by a row policy, ...` or `... by a column policy, and a write to it cannot read a masked or denied column of it ...`. Load such tables as a user none of whose roles carries a policy on them (a loader account).
- **`ALTER`, `DROP` and `CREATE OR REPLACE`** of the table, and `DROP SCHEMA` / `ALTER SCHEMA` of a schema that may hold it, are refused: `access denied: <table> is protected by a column/row policy, and altering, dropping or replacing it is refused`, or `schema <schema> holds a table protected by a column/row policy`. A policy whose schema is `*` covers every schema. `COMMENT ON` and `CREATE INDEX` on it are refused too. A `CREATE` that replaces nothing is allowed.
- **A write that reads it is refused**, even when it reads only unprotected columns: `INSERT INTO t SELECT ... FROM customer`, `CREATE TABLE t AS SELECT ... FROM customer`, a write whose `RETURNING` or `ON CONFLICT` clause reads it. The reason reads `access denied: <table> is protected by a column/row policy and cannot be read into a write statement; query it directly instead`. A write touching a covered table cannot use a positional reference (`#n`) either.
- **A multi-statement batch that reads it is refused** (`... cannot be read in a multi-statement batch; send that query on its own`), as every statement of a batch is judged like a write.

Writes and DDL that touch no covered table, and reads of covered tables as single statements, are unaffected.

### Statement shapes the gateway refuses

Before a statement reaches the node, the gateway screens a policy holder's statement for shapes its parser cannot read the way DuckDB does: every statement of a principal holding a column policy, and the writes and multi-statement batches of a principal holding a row policy. Refused, whatever the grants:

- a quoted name holding a dot, an `@`, a bracket or an escaped quote (`"a.b"`), outside an alias;
- a two-part name whose first part is a possibly-attached catalog (see [Table name resolution](../administration/access-control.md#table-name-resolution));
- a call whose target is a run-time string or another server: `query('<sql>')`, `query_table('<name>')`, `json_execute_serialized_sql`, `duckdb_table_sample`, DuckLake's `ducklake_*` functions and the per-schema macros that call them, the Iceberg functions that act on a table or schema named by a string, the `postgres_*` / `mysql_*` / `sqlite_*` passthrough and scan functions, `getenv`, and the `histogram(<table>, <column>)` table macro;
- a `SET` whose value runs SQL, and a batch that changes the schema or the search path;
- for a column-policy holder, a method call (`c.upper()`) the gateway cannot write as the plain function call DuckDB makes of it (`a method call (...) cannot be read under column policies; write it as a function call`).

A principal holding only row policies reads with `query('<sql>')` and `query_table('<name>')` as single statements: the node filters what they bind.

### Statement text and error excerpts

The functions that return the text of the running statement, `current_query()` (and its `pg_catalog.current_query` macro), `duckdb_prepared_statements()` and the `pg_catalog.pg_prepared_statements` view, are refused to a policy holder wherever the plan reaches them: a direct call, a view or secure view, a generated column, a default, a CHECK constraint, a `query()` literal, a `SET VARIABLE` value, a `LIMIT` or `OFFSET`. The node's refusal reads `QoD: function <name> is not available to principals with column or row policies` (`view <name>` for the view). Principals without policies keep `current_query()` and `duckdb_prepared_statements()`; superusers keep all four.

Every error answered to a policy holder leaves out DuckDB's excerpt of the statement (the `LINE <n>:` line and the caret line under it) and the error's `position` and `location`, on every door (FlightSQL, the native Quack front door, MCP, REST) and in the statement history and audit. Principals without policies keep the excerpt.

### Kill switches

Column-level and row-level security ship **enabled by default**. `quack-on-demand.cls.enabled = false` (env `QOD_CLS_ENABLED=false`) stops the manager signing column policies into handles and the gateway's checks from applying them, so every mask and deny is dropped, for every tenant; `quack-on-demand.rls.enabled = false` (`QOD_RLS_ENABLED=false`) does the same for row policies. The two are independent. Set the same value on every manager replica and restart them; treat either as a kill switch for an incident, not a setting to run with.

### Effective policies and caching

Column and row policies join the `RolePermission` and pool-permission rows in the per-user `EffectiveSet`. The same 60-second `PoolSupervisor` cache covers them, and the same mutator-invalidation contract applies: creating, updating or deleting a policy calls `invalidateEffectiveCache()` and moves the tenant's policy version, so a freshly-authored policy takes effect on the next statement, open sessions included. A policy snapshot is identified by its signed contents, so a different identity expansion or policy body is a different snapshot even at the same policy version, and a prepared statement is bound again when the signed policies of its connection change.

### Boot report of stored policies

At each boot the manager prints one `WARN:` line on stderr for each stored policy that cannot apply as written, naming the tenant, the role, the policy id and the table, never the mask or the predicate:

- a **mask** that a create would refuse (outside the [allowed mask forms](#allowed-mask-forms)), with the column and the kind of each refused part. Such a mask is applied as a `deny` on its column: reads of that column are refused until the mask is rewritten in the allowed forms. Unrelated columns and tables are unaffected.
- a **mask** whose result does not have its column's type, with the column and both types, once per DuckLake database holding the table. Every read of that column under the role is refused until the mask returns the column's type (see [The mask keeps the column's type](#the-mask-keeps-the-columns-type)).
- a **row policy** naming a column its table no longer has (with the missing columns), one whose predicate cannot be applied, and one whose stored predicate no longer passes validation. Each denies the reads of its table under its role. Columns are checked for policies that name their schema and table, against each of the tenant's DuckLake databases holding the table; validity is checked for every policy.

Update or delete each one listed.

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

Before each statement it sends a node, the manager installs a session handle on the node connection: a token naming the principal, the node, the pool, the policy version, the principal's column and row policies (by a reference to a signed snapshot the node fetches, see [How a column policy is applied](#how-a-column-policy-is-applied)), a single-use nonce and a 60-second expiry, signed with that node's own key. The node (`qod-node`) refuses any statement on a connection with no current principal. For a principal who is not a superuser it describes the bound plan (objects with their access and columns, functions, settings, files) and asks the manager replica that minted the handle for a verdict. That replica applies the rules above against the session's `EffectiveSet` (or asks the tenant's OPA) and returns a signed allow or refuse.

- Verdicts are cached on the node for 60 seconds (an OPA tenant's for its OPA cache TTL) per principal, policy version and plan, and dropped as soon as the tenant's policy version moves. Sessions of one user with the same grants share verdicts; bearer-token sessions share them only within one token.
- Cost: a plan the node has not judged costs one call to the replica, about 0.7 to 0.9 ms; a fresh FlightSQL query makes two (its schema probe and the statement), about 1.4 ms end to end on one host. A cached verdict adds about 0.3 ms per statement.
- A refusal is a permission error: FlightSQL `UNAUTHORIZED`, reason `access denied: Permission Error: QoD: ...`, statement history status `denied`, a `data-denial` audit event.
- When no verdict can be had in time (the replica restarted, is down or unreachable from the node), the statement reads `QoD: authorization unavailable, retry`. A single statement is retryable (FlightSQL `UNAVAILABLE`); a multi-statement submission is not (`INVALID_ARGUMENT`, since the statements before the refused one may have run).

The node-side limits are `QOD_AUTHZ_DECIDE_TIMEOUT_MS` (1 to 60000) and `QOD_AUTHZ_CACHE_ENTRIES` (0 to 10000000), forwarded to every node; the decision metrics are on the [metrics reference](/qod/reference/metrics).

## Delegating to OPA

A tenant can hand its data-access decisions to its own Open Policy Agent server (`qod tenant set-acl <tenant> --mode opa --opa-url ...`; manager defaults `QOD_ACL_MODE`, `QOD_OPA_URL`, `QOD_OPA_TIMEOUT_MS`, `QOD_OPA_CACHE_TTL_SEC`). QoD grant tables are then ignored for that tenant; memberships are still sent as identity. Pool access is asked at handshake (rule `connect`); table and file access is asked by the node's verdict pipeline (rule `statement`) on what DuckDB resolved. The `statement` input carries `client.edge` `node`, each access with `catalog`, `schema`, `table`, `verb`, `kind` (`table`, `view`, `secure_view`, `schema`, ...), the `columns` read, `via` (the outermost secure view the access is read through, `null` otherwise) and, only when non-empty, `history` (any of `renamed`, `dropped`, `replaced`, on a DuckLake read at an earlier snapshot that crossed such a change of the table, named as described in [Earlier snapshots and the change feed](#earlier-snapshots-and-the-change-feed)), and the statement's `locations` (each file with its `access`, `location` and admitting `scope`). No input carries `statement.text` (`--send-statement-text` has no effect). **Existing Rego must handle `via`**, or reads through a secure view are judged as reads of the underlying table and denied. A policy that wants history kept to the current table can deny any access carrying `history`. On a `replaced` access the `columns` are the replaced table's column names as the statement read them, not its successor's, so a column rule keyed on the successor's names can misfire. Otherwise the input does not tell an earlier-snapshot or change-feed read of an unchanged table from a read of its current rows. The starter policy and the full input are in [examples/opa](https://github.com/starlake-ai/qod/tree/main/examples/opa).

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

## Secure in production

- [ ] Create tenant users with explicit memberships (`qod user create --role ... --group ...`, or `qod_no_tables` / `qod_no_pools` to start from nothing): an omitted list attaches `qod_all_tables` and `qod_all_pools`, which is every table and every pool of the tenant ([Memberships at user creation](#memberships-at-user-creation)).
- [ ] Review every grant with a `*` part, `*.*.*` first, and who holds `qod_all_tables`: `qod role permission list --role-id <id>` per role, `qod user effective <user-id>` per user.
- [ ] Prefer pool grants naming a pool over tenant-wide ones (a null `pool_id`, the `qod_all_pools` group): a tenant-wide grant admits every current and future pool, and so every database behind them.
- [ ] Give `kind=admin` only to the people who administer the tenant: an admin creates users and grants up to what they hold ([Privilege-escalation guards](#privilege-escalation-guards)).
- [ ] Keep superusers few and check them with `qod user list` (without `--tenant` it includes them): they skip both gates.
- [ ] Leave `QOD_CLS_ENABLED` and `QOD_RLS_ENABLED` at their default `true`: setting either to `false` drops every column mask or every row policy, for every tenant ([Kill switches](#kill-switches)).
- [ ] Read the boot output for `WARN:` lines about stored masks and row policies, and fix each one ([Boot report of stored policies](#boot-report-of-stored-policies)): such a policy denies the reads it covers.
- [ ] Load tables that carry column or row policies as a user none of whose roles carries a policy on them: a policy holder cannot write them ([Writes and DDL under column or row policies](#writes-and-ddl-under-column-or-row-policies)).

See [Security hardening](./hardening.md) for the node enforcement that applies these grants and the rules no grant can lift.
