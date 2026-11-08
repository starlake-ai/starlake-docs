---
id: access-control
title: "Grant and revoke access to DuckDB tables"
sidebar_label: "Grant and revoke access"
description: "Grant a team read access to DuckDB tables, add row filters and column masks, and revoke access, from the admin UI, the qod CLI, or plain SQL."
keywords: ["duckdb access control", "duckdb acl", "grant", "revoke", "row-level security", "column masking", "rbac"]
---

Access control is **always on**. Every statement, through any door, is decided by the node that runs it against the caller's effective permission set before it executes; since 0.11.0 there is no switch to turn this off (see [Upgrading to 0.11.0](../operating/upgrading.md)). The model - roles, groups, verbs, and wildcards - is described in [Access control model](/qod/operating/rbac-model).

Everything on this page, plus user management, can also be done with plain SQL from any connected client (`CREATE ROLE`, `GRANT SELECT ON ... TO ROLE ...`, row and column policies, pool grants, `CREATE USER` / `ALTER USER ... PASSWORD` / `DROP USER`): see [Administer with SQL](/qod/administration/sql-administration).

## Grant a team read access

**Goal:** Let a group of users run SELECT statements against one or more tables in a pool.

**Prerequisites:** A tenant and a pool already exist. You are signed in as a superuser or the tenant's admin.

**Steps (UI):**

1. Pick the target tenant in the sidebar's tenant switcher. The three pages used below sit under **Users & Access Controls** in the sidebar.
2. Open **Roles** and click **+ New role**. Give the role a name (for example `bi-readers`). Add a table permission with verb `RO` (read) and the target catalog, schema, and table (use `*` to wildcard any field). Save.

   ![Roles page](/img/ui/rbac-roles.png)

3. Open **Groups** and click **+ New group**. Name it (for example `bi-team`). Add the `bi-readers` role to the group. Save.

   ![Groups page](/img/ui/rbac-groups.png)

4. Give the group a pool grant for the target pool: on the **Groups** page, click the `bi-team` edit icon, open its **Pool grants** tab, pick the pool, and click **+ Grant pool**. The pool grant is required for the members to connect to that pool.
5. Open **Users**. For each user who needs access, open their record and assign them to the `bi-team` group.

   ![Users page](/img/ui/rbac-users.png)

6. Confirm the pool grant: on the **Users** page, verify the user's row shows the pool grant for the target pool.

:::note Default memberships
A user created without explicit roles and groups joins the built-ins `qod_all_tables` and `qod_all_pools`, which already grant every table and every pool of the tenant, so a narrower team grant changes nothing for them. Create team users with `qod_no_tables` / `qod_no_pools` (or with the team's role and group) instead, or remove their built-in memberships. See [Built-in roles and groups](/qod/operating/rbac-model#built-in-roles-and-groups).
:::

**Manifest (YAML)**

```yaml
roles:
  - tenant: acme
    name: analyst
    permissions:
      - { catalog: acme_tpch, schema: tpch1, table: customer, verb: RO }
groups:
  - tenant: acme
    name: analysts
    roles: [analyst]
users:
  - tenant: acme
    username: alice
    groups: [analysts]
    poolGrants:
      - { pool: bi }
```

**CLI equivalent:**

The examples below assume `qod login` has stored a session (see [the CLI section](/qod/cli/)); CI scripts set `QOD_TOKEN` to a personal access token instead. The six steps below mirror the UI flow exactly. Surrogate ids (`<roleId>`, `<groupId>`, etc.) are returned by each create call; capture them with the `--json` flag.

```bash
# 1. Create a role
ROLE_ID=$(qod --json role create --tenant acme --name analyst --description "Read-only analyst" | jq -r .id)

# 2. Grant RO (read) on acme_tpch.tpch1.customer (repeat per table, or use "*" to wildcard any field)
qod role permission grant --role-id "$ROLE_ID" --catalog acme_tpch --schema tpch1 --table customer --verb RO

# 3. Create a group
GROUP_ID=$(qod --json group create --tenant acme --name analysts | jq -r .id)

# 4. Attach the role to the group
qod membership group-role add --group-id "$GROUP_ID" --role-id "$ROLE_ID"

# 5. Add a user to the group (or use `qod membership user-role add` to attach the role directly to a user)
#    Retrieve <userId> from `qod user list --tenant acme`
qod membership user-group add --user-id <userId> --group-id "$GROUP_ID"

# 6. Grant the group access to the pool (REQUIRED - without this the group cannot reach the pool)
#    Retrieve <poolId> from `qod pool list`
qod pool permission grant --tenant acme --pool-id <poolId> --group-id "$GROUP_ID"
```

The permission graph is: user -> roles (direct), user -> groups -> roles (via group membership), plus a required pool permission that gates which pools the principal can reach.

**Verify:** See [Verify access](#verify-access) below.

**Related:**
- [Access control model](/qod/operating/rbac-model) - verbs, wildcards, effective-set resolution
- [Administering access](/qod/operating/rbac-admin) - full RBAC CRUD reference

---

## Grant DML or DDL

**Goal:** Let a role run INSERT, UPDATE, DELETE, or schema-altering statements.

**Prerequisites:** A role already exists (or follow the steps above to create one).

**Steps (UI):**

1. With the tenant picked in the sidebar's tenant switcher, open **Users & Access Controls > Roles** and click the edit icon on the target role.
2. Add one or more table permissions with the appropriate verb:
   - `RW` for DML (INSERT, UPDATE, DELETE, MERGE, TRUNCATE) - it also covers reads on the same table
   - `DDL` for schema changes (CREATE, DROP, ALTER)
   - `ALL` to cover every verb at once

   `ALTER TABLE ... ADD COLUMN ... DEFAULT <expr>` needs both `RW` and `DDL` (or `ALL`): it is judged as an ADD COLUMN and an UPDATE.
3. Save. The verbs are collapsed to `Read`, `Write`, or `Ddl` at enforcement time; see [Access control model](/qod/operating/rbac-model) for the exact mapping.

**Manifest (YAML)**

```yaml
roles:
  - tenant: acme
    name: loader
    permissions:
      - { catalog: acme_tpch, schema: tpch1, table: orders, verb: RW }
```

**CLI equivalent:**

```bash
# Grant RW (DML) on acme_tpch.tpch1.orders to an existing role
qod role permission grant --role-id <roleId> --catalog acme_tpch --schema tpch1 --table orders --verb RW

# Grant ALL verbs on every table in the catalog (wildcard schema and table)
qod role permission grant --role-id <roleId> --catalog acme_tpch --schema "*" --table "*" --verb ALL
```

Replace `verb` with `DDL` for schema changes as needed. Omitting `catalog`/`schema`/`table` (or setting them to `"*"`) wildcards that field.

**Verify:** See [Verify access](#verify-access) below.

**Related:**
- [Access control model](/qod/operating/rbac-model) - verb-to-category mapping and enforcement logic

---

## Table name resolution

The node judges the plan DuckDB bound, so a name is checked exactly as DuckDB resolved it: `tpch1.customer` is `acme_tpch.tpch1.customer` when the pool's database is `acme_tpch`, and a two-part name whose first part is an attached catalog (`acme_tpch.customer`) is that catalog's default-schema table, judged as such.

One exception holds for a principal who carries [column or row policies](/qod/operating/rbac-model#column-level-policies). The rewriters that enforce those policies read SQL text, schema-first, while DuckDB binds a two-part name catalog-first when the first part matches a possibly-attached catalog (the tenant-db itself, any federation alias, enabled or disabled, or the built-ins `memory` / `system` / `temp`). Rather than guessing, the gateway denies such names as ambiguous for policy holders:

```
access denied: ambiguous two-part name 'acme_tpch.customer': 'acme_tpch' is an attached catalog; qualify fully as 'acme_tpch.<schema>.<table>'
```

Write the full three-part form (`catalog.schema.table`, e.g. `acme_tpch.tpch1.customer`) to proceed. For a policy holder the same guard also denies a quoted name holding a dot, a `query()` / `query_table()` call, and a batch that moves the schema or search path; no wildcard grant admits them.

After **deleting** a federated source, recycle the pool: running nodes keep the deleted alias attached until they exit, while the ambiguity guard no longer covers it. See [Federation](/qod/operating/federation).

---

## Revoke access

**Goal:** Remove a user's, group's, or role's access to a pool or table.

**Prerequisites:** The grant you want to remove exists and you know its ID (visible in the UI grant list or from the list endpoint).

**Steps (UI):**

1. Pick the tenant in the sidebar's tenant switcher; the pages below sit under **Users & Access Controls**.
2. To remove a pool grant: open **Groups**, click the group's edit icon, open its **Pool grants** tab, and click the revoke icon on the grant. (A pool grant given directly to one user is removed with the CLI or REST.)
3. To remove a role from a group: open **Groups**, edit the group, and delete the role assignment.
4. To delete a role permission entirely: open **Roles**, edit the role, and delete the permission row.

**Effect on active sessions:** every RBAC mutation moves the tenant's policy version, so open FlightSQL and native sessions resolve their grants again before their **next statement**, without a reconnect; an open native transaction the revoke affects is ended (`transaction aborted: <reason>; ROLLBACK to continue`). Verdicts cached on the nodes are dropped with the old version, so there is no TTL window to wait for.

**Manifest (YAML):** Declaratively, remove the entry from its parent's nested list (a `permissions` entry on the role, or a role/group/grant on the user) and re-import; nested collections are replaced to match the file, so the omitted entry is deleted. Top-level roles, groups, and users are upsert-only, so this prunes grants, not whole roles. See [Manage by manifest](/qod/administration/manage-by-manifest).

**CLI equivalent:**

```bash
# Remove a table permission from a role (get <permissionId> from `qod role permission list`)
qod role permission revoke <permissionId>

# Detach a role from a group
qod membership group-role remove --group-id <groupId> --role-id <roleId>

# Remove a user from a group
qod membership user-group remove --user-id <userId> --group-id <groupId>

# Remove pool access from a group (get <id> from `qod pool permission list --tenant acme`)
qod pool permission revoke <id>
```

**Verify:** Re-run the relevant list command and confirm the entry no longer appears:

```bash
# List role permissions
qod role permission list --role-id <roleId>
# List pool permissions
qod pool permission list --tenant acme
```

**Related:**
- [Administering access](/qod/operating/rbac-admin) - full RBAC CRUD reference

---

## Verify access

**Goal:** Confirm that a user sees exactly the rows and columns the policy intends - no more, no less.

**Prerequisites:** `scripts/bench/adbc.sh` is available (ships in the repo). The tenant, pool, and at least one data table exist.

**Steps (CLI - two-realm diff):**

Run the same query twice: once as the tenant user (policy enforced) and once as the bootstrap superuser (policy bypassed). Diff the outputs to see exactly what the grants, column policy, or row policy filtered or masked.

```bash
# Query as a tenant user (Basic auth + tenant/pool routing headers).
# --insecure trusts the edge's self-signed dev cert.
scripts/bench/adbc.sh --url grpc+tls://localhost:31338 \
  --user alice --password demo-alice \
  --tenant acme --pool bi --insecure \
  --query "SELECT c_mktsegment, count(*) FROM tpch1.customer GROUP BY 1 ORDER BY 1"

# Same query as the bootstrap superuser (system realm) -- bypasses RLS/CLS,
# so diffing the two outputs shows exactly what a policy filtered or masked.
scripts/bench/adbc.sh --url grpc+tls://localhost:31338 \
  --user root --password demo-root \
  --tenant acme --pool bi --superuser --insecure \
  --query "SELECT c_mktsegment, count(*) FROM tpch1.customer GROUP BY 1 ORDER BY 1"
```

Note: `scripts/bench/adbc.sh` is a CLI tool, not a REST call. It speaks the FlightSQL wire protocol over gRPC. On first run it provisions an ADBC Python venv under `${QOD_ADBC_VENV:-$HOME/.cache/qod-adbc/venv}`; set `PIP_PROXY` if you are behind a proxy.

**Verify:** The diff between the two outputs should match the intended policy - the tenant user's result should contain only the rows and columns the grant allows. If the outputs are identical, check the user's memberships: a user created without explicit roles holds `qod_all_tables` (`*.*.* ALL`). A statement no grant covers is refused with `QoD: user:<name> lacks grants on ...`.

**Related:**
- [Access control model](/qod/operating/rbac-model) - how the effective set is resolved
- [Sessions and transactions](/qod/concepts/sessions-transactions) - session lifecycle and handshake timing
