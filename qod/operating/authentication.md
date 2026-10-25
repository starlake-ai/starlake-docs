---
id: authentication
title: "Authentication: how DuckDB clients prove who they are"
sidebar_label: "Authentication"
description: "How the Flight SQL edge authenticates every DuckDB client: the provider chain, credentials, roles and groups from tokens, and session caching."
keywords: ["duckdb authentication", "auth chain", "bearer token", "session", "roles from claims"]
---

The FlightSQL edge authenticates every client connection before routing any query. This page explains how the authentication chain works, how clients pass credentials, how roles and groups are extracted from tokens, and how sessions are cached.

## Auth realm: tenant vs. system

The caller picks the realm at the wire:

- **Tenant realm** (default) - manager UI login with a tenant filled in, or FlightSQL handshake with `?tenant=X&pool=Y` and no superuser flag. Credentials are validated against tenant `X`'s configured provider (`qodstate_tenant.authConfig`). The matching `qodstate_user` row must have `tenant = X`.
- **System realm** - manager UI login with the tenant field left blank, or FlightSQL handshake with `?superuser=true`. Credentials are validated against the manager's global providers (`quack-flightsql.auth.*`). The matching `qodstate_user` row must have `tenant IS NULL`.

The two realms are strictly separated: a system credential cannot authenticate a tenant-scoped login, and vice versa. The DB authenticator uses two distinct queries (`auth.database.systemQuery` and `auth.database.tenantQuery`) instead of an `OR (tenant IS NULL OR tenant = ?)` fallback.

For the FlightSQL edge the `superuser=true` URL flag is the only signal that picks the system realm - the `tenant` and `pool` URL params are still required for query routing, but they no longer also pick the realm. A system superuser addresses a specific tenant's pool for query routing while authenticating against the global config.

## How authentication works

The edge maintains two independent provider chains: one for **Basic** credentials and one for **Bearer** tokens. On each new handshake the edge tries providers in the configured order and takes the result from the first provider that accepts the credentials.

**Basic chain** (username + password):

- `database` - bcrypt lookup against `qodstate_user` in Postgres. Enabled by default; the bootstrap admin is seeded on startup.
- `keycloak` - Resource Owner Password Credentials (ROPC) grant against a Keycloak token endpoint.
- `azure` - ROPC grant against the Azure AD `oauth2/v2.0/token` endpoint.

Google does not support ROPC; Google users must authenticate via Bearer token.

**Bearer chain** (JWT or OIDC token):

- External JWT - validates a token signed with a shared secret (`JWT_SECRET_KEY`) or an RSA/ECDSA public key (`JWT_PUBLIC_KEY_PATH`). Active when either key is set.
- Keycloak OIDC - JWKS-based validation. Enabled via `QOD_AUTH_KEYCLOAK_ENABLED=true`.
- Google OIDC - JWKS-based validation. Enabled via `QOD_AUTH_GOOGLE_ENABLED=true`.
- Azure AD OIDC - JWKS-based validation. Enabled via `QOD_AUTH_AZURE_ENABLED=true`.
- AWS Cognito - JWKS-based validation. Enabled via `QOD_AUTH_AWS_ENABLED=true`.

Each chain is tried in the order listed. The first provider that returns a valid `AuthenticatedProfile` wins; the others are not consulted. If a chain has no configured providers and a credential of that type arrives, the chain returns an error immediately.

## Passing credentials

### Basic auth (username + password)

Basic auth requires three pieces of information: the username, the password, and both `tenant` and `pool` identifiers. The edge has no defaults; every client must supply a fully-qualified target.

For the Arrow Flight SQL JDBC driver, place the identifiers in the connection URL and the credentials in the standard JDBC properties:

```
jdbc:arrow-flight-sql://host:31338/?tenant=tpch&pool=sales
user=alice
password=s3cr3t
useEncryption=true
```

The `tenant` and `pool` URL parameters become gRPC call headers. The edge reads them as `tenant` and `pool` header values.

For ADBC or any raw Flight client, pass the same headers directly in the call metadata alongside the `Authorization: Basic <base64(user:pass)>` header.

### Bearer auth (JWT or OIDC token)

Pass the token in the `Authorization: Bearer <token>` header. The `tenant` and `pool` headers are always required - JWT claims are never trusted for routing; the URL is authoritative. If either header is missing the handshake is rejected.

The authenticated username is taken from the JWT `sub` claim. For JDBC:

```
jdbc:arrow-flight-sql://host:31338/?tenant=tpch&pool=sales
token=<bearer-token>
useEncryption=true
```

A system superuser passes `superuser=true` alongside the routing target:

```
jdbc:arrow-flight-sql://host:31338/?tenant=tpch&pool=sales&superuser=true
token=<bearer-token>
```

## Roles and groups from tokens

After a provider validates a token it extracts a role string and a set of group names from the claims. The edge uses a cascading fallback for each:

**Role extraction** (configurable claim name `QOD_AUTH_ROLE_CLAIM`, default `role`):

1. The configured claim as a string.
2. The configured claim as a list (first element taken).
3. `roles` claim as a list (first element).
4. Keycloak nested `realm_access.roles` array (first element).
5. AWS Cognito `cognito:groups` list (first element).
6. Literal `"user"` if nothing matched.

**Groups extraction** (hardcoded primary claim `groups`):

1. `groups` claim as a list (all elements).
2. `cognito:groups` list (all elements).
3. Keycloak `realm_access.roles` array (all elements).
4. Empty set if nothing matched.

These token-derived role name and group names are passed through to the post-handshake authorization step. There, the edge resolves them against `qodstate_role.name` and `qodstate_group.name` in the user's tenant and union-merges them with the principal's local RBAC role and group memberships to build the **EffectiveSet**. Unknown names are silently dropped.

See the Access control model page for a full description of how the EffectiveSet is used to evaluate per-statement table-level grants.

## Sessions

### FlightSQL edge

On a successful handshake the edge mints a random UUID as a session peer ID and returns it to the client as `Authorization: Bearer <peerId>`. The client sends that value on every subsequent Flight RPC; the edge looks it up in `ConnectionContext` to recover the `(tenant, pool, user, EffectiveSet)` tuple without repeating the provider chain or re-querying Postgres.

The session is cached for `sessionTtlSec` seconds (env `QOD_SESSION_TTL_SEC`, default `3600`). After the TTL expires the peer ID is evicted. The next RPC from that client arrives as an unknown Bearer, and the edge forces a full re-handshake through the auth chain.

The TTL bounds the window during which a revoked credential or a rotated token remains effective after the next policy change.

### Management plane (UI + REST)

On a successful `/api/auth/login` the manager mints a **JWT** (HS256, signed with `QOD_SESSION_JWT_SECRET`) carrying `{sub, tenant, role, superuser, manageableTenants, jti, iat, exp}`. The token is delivered two ways:

- as an `HttpOnly Secure SameSite=Lax` cookie (`qod_session`) set by the response - the browser auto-attaches it on subsequent same-origin `/api/*` requests. JavaScript cannot read it; XSS payloads cannot exfiltrate it.
- as the `token` field in the JSON body - for CLI / static-key callers that send it via the `X-API-Key` header.

The `apiKeyGuard` middleware admits a request when EITHER path matches a verified JWT. Verification is stateless (signature + `exp` check); manager restart does not invalidate sessions as long as the JWT secret stays pinned, which makes horizontal scale-out possible.

The JWT `exp` is **absolute** (8h from mint by default, env `QOD_SESSION_IDLE_TTL_SEC`); there is no sliding-window refresh. Revocation works against a small in-process jti denylist that survives only the current process - for a hard kill of all sessions, rotate `QOD_SESSION_JWT_SECRET`.

Cookie attributes are configurable:

- `QOD_SESSION_COOKIE_SECURE` (default `auto`) - controls the `Secure` flag on the `qod_session` cookie.
  - `auto` (default): derive per request from the `X-Forwarded-Proto` header injected by any TLS-terminating ingress. `https` → `Secure`, `http` or no header → not `Secure`. This makes `qod start` on `http://localhost:20900` and helm behind a TLS ingress both work without an env var.
  - `true`: force `Secure` regardless of request scheme. Use behind a TLS terminator that does **not** inject `X-Forwarded-Proto` (some cloud LBs, TLS passthrough setups), or to require HTTPS by policy.
  - `false`: force not `Secure`. Use for stunnel-style local TLS termination where you want to opt out of derivation.
- `QOD_SESSION_COOKIE_PATH` (default `/api`) - override behind a path-rewriting reverse proxy to match the browser-visible URL prefix.

When `QOD_SESSION_JWT_SECRET` is unset, the manager generates a fresh random secret at every boot and prints it to the console. Sessions then die on restart, and HA refuses to boot (replicas cannot verify each other's tokens). Pin a stable random value (32+ chars) for production.

## Management plane (REST and UI)

The management plane covers `/api/*` calls from the admin UI and any REST client. It runs through the same `AuthenticationService` chain as the edge for the password check, but its **authorization** (the user's role and the set of tenants they may manage) is resolved separately, and always from `qodstate_user` rows, never from an identity provider's claim. A password the Database provider verified is its own grant (a `db` tenant's login takes that tenant's row; the login without a tenant, under `identitySource=db`, takes the system row). Every other login is looked up in `qodstate_user` in the realm the login names instead: a tenant's single sign-on, the manager-wide Keycloak or Azure password grant, and, under `identitySource=oidc`, every login without a tenant (the Database provider's too).

### Identity source

`auth.management.identitySource` (env `QOD_MGMT_IDENTITY_SOURCE`, default `db`):

- **`db`** - a password the Database provider verified IS the grant: the `qodstate_user` row it checked (the `(tenant, username)` row, or the system row when no tenant was given) determines `role` and `tenant`. A login answered by an OIDC password-grant (ROPC) provider is not: the IdP only proves who the user is, its role and tenant claims are **discarded**, and the grants come from the `qodstate_user` rows of the realm the login names, as in `oidc` below. An IdP admin claim alone makes nobody an admin.
- **`oidc`** - the JWT's role and tenant claims are **discarded**, for every login without a tenant. After authentication succeeds, the management plane looks up the user in `qodstate_user` and resolves role + the set of tenants they may manage from the database. An identity with no matching `qodstate_user` row is rejected with `403 not_provisioned`.

In `oidc` mode the REST login without a tenant (`POST /api/auth/login`, which `qod login` uses) still runs the same authentication chain, the database authenticator included, so a DB password is checked there as in `db` mode; what changes is the grant, which is looked up in `qodstate_user` as described below instead of being the authenticating profile's. The admin UI's bare `/ui/` offers single sign-on instead of the password form. A tenant whose own sign-in is OIDC refuses DB credentials under either `identitySource` (`400 sso_required`). The DB authenticator also serves the FlightSQL edge.

The user is named by the token's `preferred_username` claim, which is matched against `qodstate_user.username`; a token without one is named by its `email` claim, and a token with neither by its subject (a token that names none of the three is refused: a password-grant token is never named by the text typed into the form, a bearer token never named `unknown`). An address is whatever the account holder typed unless the IdP vouches for it, and it could name another user's row, the seeded superusers (`admin@localhost.local` and `admin`) included. So a name that came from the email claim binds a row only when the IdP marks the address verified (`email_verified` is true); otherwise nothing binds and the login is refused `403 not_provisioned`. For single sign-on the `email` claim is also tried as a fallback, when the user name matches no row, only when it is verified. A password login (the database check or the IdP's password grant) is matched by the authenticated user name alone: the lookup is never retried with the email. The same rule holds on the data plane: a FlightSQL or native Quack front door handshake whose user name came from an unverified email claim (the IdP's password grant answering a basic handshake, a manager-wide bearer token, or a tenant's own bearer token) is refused as unauthenticated, with a message naming the cause, and binds no row, a superuser's included.

A tenant's own SSO (`/ui/?tenant=<id>`) resolves its grants this way whatever `identitySource` says, and only from that tenant's rows: an identity whose rows are all in other tenants, or whose only row is a superuser's, is refused `403 not_provisioned`, and the session is never a superuser's. Superusers sign in through the bare `/ui/`. See [Per-tenant OIDC](./auth-providers.md#per-tenant-oidc).

So does a password login answered by the manager-wide Keycloak or Azure password grant, under either `identitySource`. With one of them enabled, a `db` tenant's password form accepts that IdP's passwords as well as the database's (the chain tries the grant whenever the database check fails), and such a login signs in as the QoD user of that tenant with the same user name as the IdP account (the token's `preferred_username`; the lookup is never retried with the email, and a token without `preferred_username` is named by its email only when the IdP marks it verified, as described above), with that row's rights only. A login naming a `db` tenant reads that tenant's rows only: an admin row opens the operator console, a `kind=user` row the [Profile page](./admin-ui.md#profile-page-regular-users), and no row at all is `403 not_provisioned`, whatever role claim the IdP issues and even when a superuser of the same name exists. A login without a tenant reads the rows the user name holds in any realm: a superuser row makes a superuser session, admin rows of tenants a multi-tenant admin session. Because the user name picks the row, the IdP's user names must be assigned by an administrator: an IdP realm that lets people choose their own user name lets them sign in as any QoD user of that name, the seeded superusers `admin@localhost.local` and `admin` included. This holds on the data plane too: a FlightSQL or native Quack front door handshake binds the row its token's `preferred_username` names, a superuser row on a `superuser=true` handshake (a Keycloak realm with "email as username" and self-registration lets a registrant choose `admin@localhost.local`).

> **Upgrading to 0.10.2: IdP password logins need a `qodstate_user` row.** Before 0.10.2 a password login answered by the Keycloak or Azure password grant took its role from the IdP's claim, for a `db` tenant's login form and for the login without a tenant under the default `identitySource=db`: an `admin` claim opened a superuser session with no `qodstate_user` row at all. It now needs a row in the realm it names, found by the IdP's user name (`preferred_username`; a row of the tenant for a tenant login; a superuser row or tenant admin rows without a tenant). Before upgrading, create the rows of the people who rely on such a login (`qod user create`).

> **Upgrading to 0.10.2: an email counts only when the IdP verified it.** Before 0.10.2 the email claim was always tried when the user name matched no row, and a user name that was itself the email claim (a token without `preferred_username`) always bound its row. Both now need the token's `email_verified` claim to be true, on a single sign-on and on an IdP password login alike; a login whose name is an unverified email is refused `403 not_provisioned`, and the single sign-on email fallback is skipped. The same holds on FlightSQL and the native Quack front door, where such a handshake is now refused as unauthenticated. This is breaking for a token that carries an `email` claim but no `preferred_username` and no true `email_verified` (a token with neither claim is named by its subject and is unaffected): have the tokens carry `preferred_username` (and name the rows by it) or `email_verified: true`. The two setups most likely to hit it:
>
> - an operator-run [external JWT](./auth-providers.md) signer (`JWT_SECRET_KEY` / `JWT_PUBLIC_KEY_PATH`), used on the data plane only, so its naming changes for the first time in 0.10.2, whose tokens name users by `email`: add `preferred_username`, or `email_verified: true`, to the tokens it mints;
> - Azure AD (Entra ID), which never sends `email_verified`: a v1 access token carries no `preferred_username`, so one named by its `email` claim is always refused. Issue v2 tokens (`accessTokenAcceptedVersion: 2` in the app registration's manifest), which carry `preferred_username`.

### Multi-tenant scope

A management session carries two pieces of authorization state:

- `superuser` - for the system login (blank Tenant ID), `true` iff the user has a `qodstate_user` row with `tenant IS NULL` and `kind = admin`; an IdP's admin role claim never counts. Cross-tenant by design. A login naming a tenant never yields it (a tenant's single sign-on, or an IdP password grant on a `db` tenant's form): it reads that tenant's rows only.
- `manageableTenants` - the set of tenants where the user has `kind = admin`. Empty for a pure superuser; non-empty for tenant-scoped admins.

The UI exposes both via `/api/auth/login` and `/api/auth/whoami` so a multi-tenant admin sees a per-screen tenant switcher rather than picking one tenant at login time.

To log in as a superuser on the UI, leave the **Tenant ID** field blank on the login form. Filling it in routes the login through the tenant realm instead. There is no separate "superuser" checkbox; the empty tenant field is the signal. The REST `/api/auth/login` endpoint follows the same rule: omitting `tenant` (or sending it as an empty / whitespace-only string) selects the system realm.

A per-request guard rejects management calls that target a tenant outside `manageableTenants` (URL path, query, or body) with `403 tenant_forbidden`. Endpoints that affect cross-tenant state (`config/server`, `manifest/export`, `manifest/import`, `tenant/create`) additionally require `superuser` and return `403 superuser_required` to multi-tenant admins.

### Authentication matrix

| `database.enabled` | OIDC provider enabled | `identitySource` | Edge authentication | REST mgmt authentication | REST mgmt authorization |
|---|---|---|---|---|---|
| true | no | db | DB Basic only (Bearer rejected) | DB Basic only | role + tenant from the DB row |
| true | no | oidc | DB Basic only | DB Basic only (the bare `/ui/` offers SSO instead of the password form) | qodstate_user grant lookup keyed on the authenticated username |
| true | yes | db | DB Basic; OIDC ROPC; OIDC Bearer | DB Basic; then OIDC ROPC. First match wins. | DB Basic: role + tenant from the row it verified. OIDC ROPC: qodstate_user grant lookup in the login's realm; JWT role/tenant discarded |
| true | yes | oidc | DB Basic; OIDC ROPC; OIDC Bearer | DB Basic tried first; then OIDC ROPC. First match wins. | qodstate_user grant lookup keyed on the authenticated user name (`preferred_username`); JWT role/tenant discarded |
| false | no | any | nothing enabled; all requests rejected | nothing enabled; all requests rejected | n/a |
| false | yes | db | OIDC ROPC; OIDC Bearer | OIDC ROPC only | qodstate_user grant lookup in the login's realm; JWT role/tenant discarded |
| false | yes | oidc | OIDC ROPC; OIDC Bearer | OIDC ROPC only | qodstate_user grant lookup; JWT role/tenant discarded |

Two cross-cutting refinements that the column structure above does not show:

- **Per-tenant bearer client (edge only).** When a tenant configures its own client on `qodstate_tenant.authConfig` (`clientId`, plus its provider's other fields: see [Per-tenant OIDC client override](#per-tenant-oidc-client-override-google)), the OIDC Bearer entry for that tenant's handshakes validates tokens against that client instead of the manager-wide one. No client secret is involved, and the chain shape is unchanged.
- **Realm-aware DB lookup (edge + mgmt).** The DB authenticator uses `systemQuery` (matching `tenant IS NULL`) for system-realm logins - UI form with empty Tenant field, or FlightSQL handshake with `?superuser=true` - and `tenantQuery` (matching `tenant = ?`) for tenant-realm logins. Same chain placement, different row.

Recommended combinations:

- Local dev or bootstrap: `database.enabled=true`, no OIDC, `identitySource=db`. The seeded `admin@localhost.local / admin` flow works out of the box.
- Production with an IdP, strict OIDC management: `database.enabled=false`, OIDC enabled, `identitySource=oidc`. Every login goes through the IdP and the manager controls authorization via `qodstate_user`.
- Production with IdP and DB break-glass for edge clients: `database.enabled=true`, OIDC enabled, `identitySource=oidc`. JDBC clients can still hit FlightSQL with DB credentials, but management login is forced through the IdP.

With an OIDC provider enabled, an IdP's role claim grants nothing on the management plane under either `identitySource`: provision the `qodstate_user` rows of the people who sign in through the IdP's password grant too (`qod user create`), as for single sign-on.

## Per-tenant OIDC client override (Google)

By default every Google OIDC tenant validates tokens against the single `quack-flightsql.auth.google.*` block - one `clientId` / `clientSecret` for the whole manager. Tenants on Google can OPT IN to a dedicated OAuth client by setting the per-tenant `clientId` field on the tenant's auth provider in the UI (or via `setTenantAuth` in the REST API):

- `clientId` - the tenant's Google OAuth client ID (e.g. `<tenant>.apps.googleusercontent.com`).

When set, the edge substitutes the per-tenant authenticator into the bearer chain for that tenant's handshakes; for every other tenant the global Google authenticator is used as before. Validating a bearer token needs only Google's public keys and the client id, so the override reads no client secret; the client secret a tenant stores serves its admin-console sign-in ([Per-tenant OIDC](./auth-providers.md#per-tenant-oidc)). Keycloak, Azure AD and AWS Cognito tenants get the same override from their own fields ([Authentication providers](./auth-providers.md#per-tenant-google-oauth-clients)). The `setTenantAuth` REST endpoint invalidates the cached per-tenant entry so the next handshake re-reads `qodstate_tenant.authConfig`.

Tenants that have NOT set `clientId` keep using the global block - adoption is incremental.

## Running without providers (development only)

If all provider chains are empty - no `database`, no JWT keys, no OIDC providers enabled - the edge logs a startup warning:

```
FlightSQL edge listening on ... (auth: OPEN (trust-the-client; configure auth.* in application.conf for prod))
```

In this mode the edge skips credential validation entirely and trusts whatever username the client supplies in the Basic header. A session peer ID is still minted and the `(tenant, pool, user)` tuple is still resolved from headers.

This fallback exists for local development when standing up a Postgres instance just for auth is inconvenient. Never use it in any shared or production environment. Enable at least the `database` provider (`QOD_AUTH_DB_ENABLED=true`, which is the default) before exposing the edge to any network.

For all configuration keys and their defaults see [/reference/configuration](/qod/reference/configuration).
