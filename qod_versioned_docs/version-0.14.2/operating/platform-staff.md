---
id: platform-staff
title: Platform staff
description: "Give support or accounting staff tenant-less QoD accounts that reach only the module routes and console pages their platform roles allow, never tenants, pools or data."
keywords: ["platform staff", "staff users", "platform roles", "permissions", "manager modules", "console pages"]
---

A **staff user** is a tenant-less account that is not a superuser. It holds **platform roles**, named bundles of permissions that [manager modules](../contributing/extending.md#manager-modules-platform-permissions-and-console-pages) declare, and reaches only the module routes and [console pages](./admin-ui.md#platform-section-and-module-pages) those permissions allow. It is meant for people who operate a hosted service built on QoD (support, accounting) and must not get full control of every tenant, pool, node and user, as a superuser would.

Core declares no permission. On a manager with no module loaded, or with modules that declare none, a staff user can sign in, see their profile and manage their own personal access tokens, and nothing else: a staff user can do nothing in core that a non-admin user cannot.

## The model

| Account | `tenant` | `kind` | What it holds |
|---|---|---|---|
| Superuser | none | `admin` | Every permission, implicitly. There is no stored `superuser` role. |
| Staff user | none | `staff` | The union of the permissions of its platform roles (zero or more). |
| Tenant user | a tenant | `admin` or `user` | Tenant roles and groups; never a platform permission. |

- A staff user has no tenant, and holds no tenant roles or groups (`400 memberships_not_applicable`). The database refuses kind `staff` on a tenant row. A person who also works in a tenant gets a second account there.
- A permission is named `<module name>.<rest>`, where `<rest>` is segments of `a-z`, `0-9` and `_` joined by dots (for example `hosted.billing.read`). The `platform.` prefix is reserved for core. The manager refuses to boot on a module that declares a malformed or duplicate permission.
- A platform role is a name, an optional description and a set of permissions. Role names are unique ignoring case, and `superuser` (any case) is reserved.
- A role may keep a permission that no loaded module declares any more (a module removed, or a manifest imported into a manager without it). Such a permission is kept, so a module loaded again finds its roles intact, but it grants nothing. Boot prints one stderr line per role and permission: `WARN: platform role '<role>' grants '<permission>', which no loaded module declares; it has no effect`.

Staff are not part of the data-plane authorization model, so a platform role change moves no tenant's policy version and flushes no node's verdict cache.

## Managing platform roles and staff users

Everything here is superuser only. A tenant admin gets `403 superuser_required`; a staff user is refused earlier with `403 admin_required`. Every write is audited.

### Permissions

```bash
qod platform permission list
```

`GET /api/platform/permission/list` lists every permission a loaded module declares, as `{name, module, description, declared: true}`, followed by every permission a stored role holds that no loaded module declares, as `{name, declared: false}`.

### Roles

```bash
qod platform role create --name support --description "Support desk" \
  --permission hosted.tenants.read --permission hosted.signups.read
qod platform role list
qod platform role update <ROLE_ID> --permission hosted.tenants.read   # replaces the whole set
qod platform role update <ROLE_ID> --description ""                   # clears the description
qod platform role update <ROLE_ID> --clear-permissions
qod platform role delete <ROLE_ID>
```

| Endpoint | Body | Notes |
|---|---|---|
| `GET /api/platform/role/list` | | `{roles: [{id, name, description, permissions}]}` |
| `POST /api/platform/role/create` | `{name, description?, permissions}` | |
| `POST /api/platform/role/update` | `{id, name?, description?, permissions?}` | A field left out is kept, an empty `description` clears it, `permissions` replaces the set. |
| `POST /api/platform/role/delete` | `{id}` | Removes the role from every staff user that holds it. |

A permission no loaded module declares is refused with `400 unknown_permission`. On an update only the permissions the request adds are checked, so a role that still holds an undeclared permission can be renamed or edited without dropping it. A name that another role holds, ignoring case, is `409 name_taken`; `superuser` is `400 reserved_name`.

### Staff users

Staff users are created and changed through the ordinary user endpoints with `kind: "staff"` and no tenant:

```bash
qod user create --username ana@example.com --kind staff --platform-role support
qod user update <USER_ID> --platform-role support --platform-role billing   # replaces the set
qod user update <USER_ID> --clear-platform-roles
qod user update <USER_ID> --no-enabled                                      # locks the account
qod platform staff list
```

- `user/create` takes `platformRoles: [names]`, matched ignoring case; omitted means none. On `user/update`, omitted keeps the stored set and `[]` clears it.
- `platformRoles` on any kind other than `staff`, or `kind: "staff"` with a tenant, is `400 invalid_kind`. An unknown role name is `400 unknown_role`.
- A kind change away from `staff` drops the row's platform roles. A row that becomes staff gets exactly the roles the request names, none when it names none.
- Changing a superuser (`admin`) to `staff` is a demotion: the `last_superuser` guard applies. A `user/create` naming an existing superuser with another kind is refused with `409 name_taken` and writes nothing; demote it with `user/update`.
- `GET /api/platform/staff/list` (`qod platform staff list`) answers `{users: [...]}`, every staff user with its `platformRoles`.

In the console, **Settings > Staff** does the same: see [Staff page](./admin-ui.md#staff-superuser-only).

## Signing in

A staff user signs in through the system login: the bare `/ui/` with the tenant field left blank, or `qod login` with no tenant. That is a password login (the database authenticator), or system-scope OIDC under `QOD_MGMT_IDENTITY_SOURCE=oidc`. Lockout, forced password change and the other login rules apply as for any account (see [Authentication](./authentication.md)).

- A tenant login never binds a staff row.
- An identity that also holds an admin grant signs in as that admin, not as staff.
- The session's role is `staff`. The login response carries `admin: false` and `staff: true`, and `GET /api/auth/whoami` (`qod whoami`) adds `staff: true` and the user's current `permissions`.
- Under system OIDC, the QoD user name of a staff user must equal the IdP's `preferred_username`. A row matched only by a verified email signs in, then every request answers `401`, because the per-request check looks the row up by name.

## What a staff user reaches

A staff session or personal access token gets its own allowlist on the REST API, and `403 admin_required` everywhere else:

- `GET /api/auth/whoami`, `POST /api/auth/logout` and its own personal access tokens (`/api/auth/pat/create`, `list`, `revoke`, `delete`, `tools`).
- `GET /api/console/pages`, the [module pages](./admin-ui.md#platform-section-and-module-pages) its permissions allow.
- The path prefixes loaded modules declare for staff, each under `/api/<module name>/`. The module's routes there check the permission themselves.

The profile routes of regular users (usage, statements, pools, S3 credentials, undrop) and the Starlake SSO ticket stay closed, and so do every tenant, pool, node, user and branch route of core. Paths are matched on whole path segments, so an encoded `/` inside a segment cannot reach another route.

**No data plane.** Every door to data binds a tenant-less account only when its kind is `admin`, so a staff user is refused as an unknown user on FlightSQL, the native Quack front door (`:9494`) and the admin REST SQL routes. `/mcp` refuses a personal access token whose tenant-less owner is not `admin` (`401`), and the [REST data edge](../connecting/rest-data-edge.md) refuses every tenant-less token.

**Revocation is immediate.** A staff session is checked against its user row on every request, and its permissions are read from that row, never copied into the session JWT. Disabling or deleting the user, changing its kind, or changing its roles or a role's permissions takes effect on the next request, although the JWT is still valid. On another HA replica it takes effect once that replica has seen the change, through its NOTIFY or its periodic snapshot refresh.

**Personal access tokens.** A staff user's token carries its owner's current permissions. A token minted with `--drop-admin` (`dropAdmin`) holds none.

The live check covers staff sessions only: a superuser session whose row is demoted to staff keeps its REST superuser rights until its JWT expires.

## Manifests

A [manifest export](./manifest.md#platform-roles-and-staff-users) carries a top-level `platformRoles` section and, on each staff user, its `platformRoles`. An import upserts the listed roles by name and gives every tenant-less user it lists exactly its listed roles. Permissions no loaded module declares import as they are, so a backup always restores.

## Upgrading and HA

The release that adds staff users (0.14.2) is one way: an older manager reads every staff user as a superuser, with full data access. Rolling back needs the control-plane backup taken before the upgrade, and in an HA deployment the rollout must finish before anyone creates a staff user. See [From 0.14.1 to 0.14.2](./upgrading-0-14.md#from-0141-to-0142).

## Secure in production

- [ ] Create staff users only once every manager replica runs 0.14.2 or later.
- [ ] Give each staff user the narrowest role that does the job: a permission is valid across every tenant the module covers.
- [ ] Under system OIDC, provision each staff user under the IdP's `preferred_username`, assigned by an administrator, never self-chosen.
- [ ] Review the boot `WARN: platform role ... which no loaded module declares` lines after removing or upgrading a module, and drop the permissions you no longer want.
- [ ] Mint staff automation tokens with an expiry (`qod auth pat create --expires-at`).
