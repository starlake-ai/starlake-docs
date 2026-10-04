---
id: rbac-admin
title: Administering access
description: "Recipes for managing users, roles, groups, memberships and pool grants on a DuckDB gateway with the qod command-line tool."
keywords: ["rbac", "duckdb users", "roles", "groups", "pool grants", "qod cli"]
---

This page contains task-oriented recipes for managing users, roles, groups, memberships, and pool grants with the [qod CLI](/qod/cli/). They require a valid admin credential on every request.

For a description of the underlying data model, the EffectiveSet, pool-access gates, and privilege-escalation rules, see the "Access control model" page.

## Authentication

Every RBAC endpoint admits either of two transports:

- **Static key** - set `QOD_API_KEY` in the manager environment and pass it as `X-API-Key`. Best for CLI scripts and CI.
- **Session token** - `POST /api/auth/login` with `{"username":"...","password":"..."}`. Two ways to use the response:
  - **Cookie** (browser default). The login response sets `qod_session=<jwt>` as an HttpOnly Secure SameSite=Lax cookie; the browser auto-attaches it on subsequent same-origin calls. JavaScript cannot read or send it manually - the `/api/auth/whoami` and `/api/auth/logout` endpoints accept the cookie automatically.
  - **Header** (CLI). The JSON body still contains a `token` field; pass it as `X-API-Key: $TOKEN` for non-browser callers.

## Tenant scope on every endpoint

Every RBAC handler checks the caller's session scope before mutating. A tenant-A admin session calling a tenant-B endpoint (resource id, query, or body field) gets:

```json
{ "error": "tenant_forbidden",
  "message": "session has no admin grant on tenant 't-...'" }
```

with HTTP `403`. Superuser and static-key sessions bypass the gate. Unknown ids return `404` (not `403`) so a probe cannot distinguish "exists in another tenant" from "doesn't exist at all". The pattern covers id-only endpoints (`/role/delete`, `/user/delete`, `/group/delete`, `/role/permission/revoke`, `/pool/permission/revoke`, all 6 membership ops, the per-user `/effective`) - those resolve the owning tenant from the resource before applying the check.

The examples below assume `qod login` has stored a session (see [the CLI section](/qod/cli/)); CI scripts can use `QOD_API_KEY` instead.

---

## 1. Create a role and grant a table permission

A role bundles one or more table permissions. First create the role, then attach grants to it.

**Create a role**

```bash
qod role create --tenant acme --name analyst --description "Read-only analyst role"
```

Response includes the generated `id` field. Copy it for the next step.

```json
{"id":"r-7a2b...","tenantId":"...","name":"analyst","description":"Read-only analyst role","builtin":false,"createdAt":"..."}
```

Names starting with `qod_` (any case) are reserved for the [built-in roles and groups](/qod/operating/rbac-model#built-in-roles-and-groups) every tenant carries (`qod_all_tables`, `qod_no_tables`, `qod_all_pools`, `qod_no_pools`) and are refused with `400 reserved_name`. Built-ins cannot be deleted or edited (`409 builtin_protected`); only their user memberships change.

**Grant a table permission to the role**

Request body fields: `roleId` (required), `catalog` (default `*`), `schema` (default `*`), `table` (default `*`), `verb` (required; one of `RO`, `RW`, `DDL`, `ALL`). `RO` grants read-only, `RW` grants read + any DML (INSERT/UPDATE/DELETE/MERGE/TRUNCATE), `DDL` grants CREATE/DROP/ALTER, `ALL` grants everything.

```bash
qod role permission grant --role-id <role-id> --catalog tpch --schema tpch1 --table customer --verb RO
```

To grant access to every table in a tenant (wildcard), omit `--catalog`, `--schema`, and `--table` (they default to `*`):

```bash
qod role permission grant --role-id <role-id> --verb RO
```

In the admin UI: pick the tenant in the sidebar's tenant switcher, open **Users & Access Controls > Roles**, create a role, then use the permission editor to add grants.

---

## 2. Create a group and attach a role

Groups collect multiple users under a shared set of role assignments.

**Create a group**

```bash
qod group create --tenant acme --name data-team --description "Data analysts group"
```

**Attach a role to the group**

```bash
qod membership group-role add --group-id <group-id> --role-id <role-id>
```

This command is idempotent: calling it multiple times with the same pair produces no error and no duplicate row.

To remove the assignment:

```bash
qod membership group-role remove --group-id <group-id> --role-id <role-id>
```

In the admin UI: pick the tenant in the sidebar's tenant switcher, open **Users & Access Controls > Groups**, create a group, then use the role assignment controls to link roles.

---

## 3. Create a user

**Tenant-scoped user**

A tenant-scoped user can only connect to pools belonging to their tenant. The `kind` field (`--kind`, `user` by default or `admin`) controls management rights in the admin console and REST API; it is not an RBAC role and grants no data access.

Roles and groups are attached at creation with the repeatable `--role` and `--group` flags (role and group names in the user's tenant). Omitting a flag attaches the built-in default: `qod_all_tables` for roles and `qod_all_pools` for groups, which gives the user **full data access to every table and every pool of the tenant**. Name narrower memberships to start smaller:

```bash
# Full access (defaults: qod_all_tables + qod_all_pools)
qod user create --tenant acme --username alice --password s3cr3t

# Only the analyst role, no pool yet (grant pool access in step 5)
qod user create --tenant acme --username bob --password s3cr3t \
  --role analyst --group qod_no_pools
```

An unknown name is refused with `400 unknown_role` / `unknown_group`; an explicitly empty list in the REST body (`"roles": []`, `"groups": []`) with `400 roles_required` / `groups_required`.

**Superuser (tenant null)**

A superuser has `tenant: null`. Superusers bypass the pool-access gate and the per-statement ACL gate entirely. Only an existing superuser may create another superuser; a tenant-scoped admin attempting this call receives a 403.

```bash
qod user create --username ops-admin --password 'str0ng!' --superuser --kind admin
```

Passing `--superuser` (and omitting `--tenant`) is equivalent to passing `"tenant": null` on the REST body. Superusers bypass RBAC, so they take no roles or groups (`400 memberships_not_applicable`).

In the admin UI: open **Users & Access Controls > Users** in the sidebar, click **+ New user** (**+ Pre-provision user** for an OIDC tenant), fill in the form. The **Roles** and **Groups** checkbox dropdowns start preselected on `qod_all_tables` and `qod_all_pools`; the create button stays disabled while either is empty. The superuser option appears only when the logged-in user is themselves a superuser, and disables both dropdowns.

---

## 4. Add a user to a role and to a group

These commands are idempotent: adding an already-existing membership returns 204 with no error.

**User to role**

```bash
qod membership user-role add --user-id <user-id> --role-id <role-id>
```

**User to group**

```bash
qod membership user-group add --user-id <user-id> --group-id <group-id>
```

To remove either membership, run the corresponding `qod membership ... remove` command with the same flags.

In the admin UI: on the user detail row, use the role and group assignment controls.

---

## 5. Grant pool access

A pool permission allows a user or a group to open FlightSQL connections to a specific pool. Pass exactly one of `userId` or `groupId`. Set `poolId` to a specific pool's `id` (the UUID returned in `PoolResponse.id`) or omit it to grant access to every pool in the tenant.

**Grant a specific pool to a user**

```bash
qod pool permission grant --tenant acme --pool-id <pool-uuid> --user-id <user-id>
```

**Grant all pools in a tenant to a group**

```bash
qod pool permission grant --tenant acme --group-id <group-id>
```

Omitting `--pool-id` grants access to every current and future pool in the tenant.

**Revoke a pool grant**

Use the `id` from the grant response:

```bash
qod pool permission revoke <grant-id>
```

**List pool grants**

All the filters below are optional; any combination narrows the results:

```bash
qod pool permission list --tenant acme --user-id <user-id>
```

In the admin UI: pool grants are managed per group. Open **Users & Access Controls > Groups**, click a group's edit icon, and use its **Pool grants** tab (**+ Grant pool** to add, the revoke icon to remove); a built-in group's pool grants are fixed. Grants given to a single user are visible in the Users page's **Pool grants** column; add or remove them with the CLI or REST.

---

## 6. Inspect a user's effective permissions

The effective-permissions endpoint returns the full closure of roles, groups, pool grants, and table permissions for a given user without requiring you to trace the graph manually.

```bash
qod user effective <user-id>
```

Example response shape:

```json
{
  "user": {"id":"...","tenant":"acme","username":"alice","kind":"user",...},
  "roles": [{"id":"...","name":"analyst",...}],
  "groups": [{"id":"...","name":"data-team",...}],
  "pools": [{"id":"...","tenantId":"...","poolId":"<pool-uuid>",...}],
  "tablePerms": [
    {"id":"...","roleId":"...","catalogName":"tpch","schemaName":"tpch1","tableName":"customer","verb":"RO",...}
  ]
}
```

`tablePerms` lists every permission reachable through the user's direct roles and through roles inherited via group membership. This is the set the ACL gate evaluates at statement time.

In the admin UI: click a user on the **Users** page to open the effective-permissions panel.

---

## Reference: list commands

| Resource | Command |
|---|---|
| Users | `qod user list --tenant <name>` (omit `--tenant` to list all users including superusers) |
| Roles | `qod role list --tenant <name>` |
| Role permissions | `qod role permission list --role-id <id>` |
| Groups | `qod group list --tenant <name>` |
| Group role memberships | `qod membership group-role list --group-id <id>` |
| Pool permissions | `qod pool permission list --tenant <name> --user-id <id> --group-id <id>` |
