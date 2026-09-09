---
id: sql-administration
title: Administer with SQL
---

Everything on this page's siblings - table grants, row and column policies,
masking, roles, groups, pool access, and user management - can also be
administered with plain SQL statements over the regular FlightSQL connection.
Any SQL client works: DBeaver, ADBC, `qod shell`, a JDBC notebook. The manager
recognizes these statements at the edge, executes them against the control
plane, and answers directly; they are never forwarded to a DuckDB node.

The dialect is a front-end over the same machinery as the UI, REST, and CLI:
expressions are validated by the same parser, caches invalidate the same way,
and changes propagate across HA replicas identically. Anything you create with
SQL is visible in the UI and exportable by manifest, and vice versa.

## Who can run admin statements

The session principal must be a **superuser** or a **tenant admin** of the
tenant that owns the pool the connection is bound to. Regular users receive
`PERMISSION_DENIED admin_required`. Everything resolves within the session's
tenant; there is no cross-tenant addressing, superusers included.

The whole dialect sits behind `QOD_SQL_ADMIN_ENABLED` (default `true`). With
the flag off, these statements are rejected exactly as they were before the
feature existed. Admin SQL is available on the FlightSQL edge only: statements
arriving through the MCP server or catalog preview paths are denied regardless
of the flag.

## Statements by family

### Roles, membership, groups

```sql
CREATE ROLE analyst;
DROP ROLE IF EXISTS analyst;

GRANT ROLE analyst TO USER alice;
GRANT ROLE analyst TO GROUP finance;
REVOKE ROLE analyst FROM USER alice;

ALTER GROUP finance ADD USER alice;
ALTER GROUP finance DROP USER alice;
```

### Table grants

```sql
GRANT SELECT ON acme_tpch.tpch1.customer TO ROLE analyst;
GRANT INSERT, UPDATE, DELETE ON acme_tpch.tpch1.orders TO ROLE etl;
GRANT DDL ON acme_tpch.tpch1.* TO ROLE dba;
GRANT ALL ON *.*.* TO ROLE root_like;

REVOKE SELECT ON acme_tpch.tpch1.customer FROM ROLE analyst;
REVOKE ALL ON acme_tpch.tpch1.customer FROM ROLE analyst;
```

Privilege lists map onto the stored verbs described in
[Access control model](/qod/operating/rbac-model): `SELECT` alone is `RO`, any
of `INSERT`/`UPDATE`/`DELETE` is `RW`, `DDL` is `DDL`, `ALL` is `ALL`. Mixing
`DDL` with DML privileges is rejected (use `ALL`). Table references take 1-3
dot-separated segments; missing leading segments become `*` wildcards.

Revoking matches stored rows literally: `REVOKE ALL ON *.*.*` removes a grant
row stored as `(*, *, *)`, not every grant the role holds. Revoking a grant
that does not exist succeeds with `revoked = 0` (there is no warning channel
over FlightSQL).

### Row policies (RLS)

```sql
CREATE OR REPLACE ROW POLICY ON acme_tpch.tpch1.orders FOR ROLE analyst
  USING (region = ${tenantId} OR owner = ${user});

DROP ROW POLICY IF EXISTS ON acme_tpch.tpch1.orders FOR ROLE analyst;
```

Policies are keyed by `(role, catalog, schema, table)`. `OR REPLACE` upserts;
a plain `CREATE` on an existing key is refused with `ALREADY_EXISTS`. The
`USING` body passes through the same predicate validator as the REST path:
one boolean expression, identity tokens `${user}` / `${tenant}` /
`${tenantId}` / `${groups}` / `${roles}`, no subqueries, 1024 characters max.
A body that ends inside a `--` line comment is rejected.

### Column policies (CLS deny and masking)

```sql
CREATE OR REPLACE COLUMN POLICY ON acme_tpch.tpch1.customer COLUMN c_email
  FOR ROLE analyst MASK USING (SHA256(CAST(c_email AS VARCHAR)));

CREATE COLUMN POLICY ON acme_tpch.tpch1.customer COLUMN c_ssn
  FOR ROLE analyst DENY;

DROP COLUMN POLICY IF EXISTS ON acme_tpch.tpch1.customer COLUMN c_email
  FOR ROLE analyst;
```

Keyed by `(role, catalog, schema, table, column)`, same `OR REPLACE`
semantics. Mask expressions run through the same transform validator as the
UI: one scalar expression referencing only the protected column.

### Pool access

```sql
GRANT CONNECT ON POOL bi TO USER alice;
GRANT CONNECT ON POOL acme_tpch.bi TO GROUP finance;
REVOKE CONNECT ON POOL bi FROM USER alice;
```

Pool names are unique per tenant, so the `tenantdb.` qualifier is optional and
never needed to disambiguate; naming a tenant-db that does not own the pool
fails with `unknown_pool` rather than selecting a different pool.

### Users

```sql
CREATE USER alice PASSWORD 'secret';
CREATE USER ops PASSWORD 'secret' ADMIN;
ALTER USER alice PASSWORD 'rotated';
DROP USER IF EXISTS alice;
SHOW USERS;
```

User statements manage **tenant users of the session tenant only**. The
dialect cannot create superusers; those are minted by superusers through
REST/CLI. `ADMIN` sets the tenant-admin label, which a tenant admin may grant
(the same as REST allows). `CREATE USER` is a true create: an existing
username in the tenant is refused, never overwritten. Email-format usernames
set the `email` column automatically, exactly as everywhere else.

`ALTER USER ... PASSWORD` uses the same rotation path as REST `user/update`,
so lockout counters (`failed_attempts`, `locked_at`) are cleared by the write.
Rotation and drop are strictly per `(tenant, username)` row: the same
username in another tenant is a different principal and is never affected.
`DROP USER` refuses the session's own username. For a single credential across
tenants, use tenant OIDC rather than database passwords: the credential then
lives at the identity provider.

Password literals are protected end to end: admin statements are excluded
from statement history, the executor logs only the command kind, and the
edge's DEBUG statement logging redacts recognized admin statements. Prefer
plain (non-prepared) statements for admin SQL; the prepared path works but
advertises a generic schema at prepare time.

### Introspection

```sql
SHOW ROLES;
SHOW GRANTS FOR ROLE analyst;
SHOW ROW POLICIES;                         -- also: ON <table> | FOR ROLE <r>
SHOW COLUMN POLICIES FOR ROLE analyst;
SHOW POOL GRANTS;                          -- also: FOR USER <u> | FOR GROUP <g>
SHOW USERS;
```

`SHOW ... ON <table>` matches the stored tuple exactly, wildcards included.

## Caveats

- **Name shadowing.** `SHOW roles`, `SHOW grants`, and `SHOW users` are
  claimed by the dialect, so a real table with one of those names cannot be
  described with a bare `SHOW`. Quote the identifier to reach DuckDB:
  `SHOW "users"`. `users` is the likeliest real-world collision.
- **Not transactional.** Admin statements are control-plane writes; a
  surrounding `BEGIN` on the data connection does not cover them.
- **Session staleness.** Authorization is evaluated against the principal
  snapshot taken at connection handshake. A demoted admin keeps dialect
  authority on an already-bound connection until the session context expires
  (`sessionTtlSec`, default 3600s). New connections see the change
  immediately.
- **One statement per request**, like every statement on the FlightSQL edge.

## When to use which surface

SQL is the fastest path when you are already in a SQL client and want to
grant, mask, or inspect without switching tools. The
[manifest](/qod/administration/manage-by-manifest) remains the right surface
for declarative, reviewable bulk state; the [CLI](/qod/cli/) for scripting
with surrogate ids; the UI for guided flows. All four write the same store.
