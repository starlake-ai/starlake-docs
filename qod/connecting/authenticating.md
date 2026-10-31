---
id: authenticating
title: "Authenticating a client to DuckDB over Flight SQL"
sidebar_label: "Authenticating"
description: "How a Flight SQL client authenticates to the DuckDB gateway: password or bearer token, how the tenant is resolved, and the TLS settings to use."
keywords: ["duckdb authentication", "flight sql auth", "bearer token", "password", "tls"]
---

The FlightSQL edge authenticates every connection independently of the admin UI / REST session. This page covers the two credential paths a client can use, how the tenant is resolved, and TLS. For the operator side (configuring providers), see [Authentication](/qod/operating/authentication) and [Authentication providers](/qod/operating/auth-providers).

## Two credential paths

The edge accepts either Basic credentials or a bearer JWT.

### Basic (username + password)

The client sends a username and password (the `user` / `password` JDBC params, or the ADBC `username` / `password` kwargs). They are validated by the tenant's configured provider, the database bcrypt backend or an OIDC provider's resource-owner-password flow. The `tenant` and `pool` must be supplied as headers / URL params; both are required.

### Bearer JWT

The client presents a validated JWT as the bearer token. The user is taken from the token's `sub` claim. The `tenant` and `pool` headers are always required - the edge does NOT read a tenant claim from the JWT; the URL is authoritative.

In both paths the owning database (tenant-db) is resolved server-side from `(tenant, pool)`; the client never names it. A disabled tenant or pool causes the handshake to fail as unauthenticated.

## Auth realm: tenant vs. system superuser

Two URL params pick which realm validates your credentials. The realm choice is independent of the routing target - a system superuser still addresses a specific `(tenant, pool)` for the query.

- `tenant=X&pool=Y` (no `superuser` flag) - **tenant realm**. Credentials are checked against tenant `X`'s configured auth provider (`qodstate_tenant.authConfig`); the matching `qodstate_user` row must have `tenant = X`.
- `tenant=X&pool=Y&superuser=true` - **system realm**. Credentials are checked against the manager's global auth providers (`quack-flightsql.auth.*` in `application.conf`); the matching `qodstate_user` row must have `tenant IS NULL`. The tenant/pool params still drive query routing.

There is no fallback between the two: a system credential cannot authenticate a tenant-scoped login and vice versa. Pre-existing JDBC URLs that used the bootstrap admin (`admin@localhost.local`) against tenants must add `?superuser=true` after upgrading.

```
# Tenant user
jdbc:arrow-flight-sql://host:31338/?tenant=tpch&pool=sales

# System superuser targeting the same tenant
jdbc:arrow-flight-sql://host:31338/?tenant=tpch&pool=sales&superuser=true
```

## No authenticator, no boot

There is no trust-the-client mode. A manager with no FlightSQL authenticator (`QOD_AUTH_DB_ENABLED=false` and no Keycloak, Azure, Google, AWS or external JWT provider) refuses to boot, naming what to set; system-scope OIDC (`QOD_MGMT_OIDC_*`) signs in to the admin UI and REST only and does not count. Were a handshake ever to reach an edge with no provider, it is refused, superusers included. The admin UI always shows a login.

## TLS

Edge TLS is on by default. On first boot the manager generates a self-signed certificate under `certs/`, so clients must either skip certificate verification or trust a CA-signed certificate you supply:

- JDBC: `useEncryption=true&disableCertificateVerification=true`.
- ADBC: `DatabaseOptions.TLS_SKIP_VERIFY = "true"`.

To remove the skip-verify flag, install a CA-signed certificate and point the edge at it; see [TLS](/qod/operating/tls). When edge TLS is disabled, connect with `grpc://` (ADBC) or `useEncryption=false` (JDBC) instead.

## Relationship to the REST session

The username/password you use here is the same credential set the admin UI accepts, but the mechanisms are separate: the UI mints a session token for `/api/*` calls, while the edge authenticates each Flight connection with Basic or JWT. A REST credential (a UI or CLI session token, or a PAT, sent as `X-API-Key`) is not a Flight credential.

Personal access tokens (`qod_pat_...`) are a third credential: they authenticate the [MCP server](/qod/connecting/mcp) for AI agents, and on `/api/*` a PAT in the `X-API-Key` header is accepted wherever its owner's session would be - though a token minted with a narrower scope carries only that scope, not the owner's full reach (see [Scoped tokens and delegation](/qod/connecting/mcp#scoped-tokens-and-delegation)). The Flight edge does not accept PATs.

The REST endpoints that run SQL on a node for you (catalog preview and data diff, undrop, restore, and the Iceberg preview and diff) run each statement as the credential's principal: a UI or CLI session as its user, a PAT as its owner with the token's own restriction (pools, `maxRows`, branch-only). They pass the FlightSQL handshake's gate first (tenant and pool kill switches, user registered and enabled, pool access), then the node judges each statement against that user's grants, column masking and row policies exactly as on a query over the edge, and a denied table answers `403 acl_denied`. A superuser known only through OIDC, with no `qodstate_user` row, is refused there, as on FlightSQL. A token that resolves to no live session or PAT is refused with `401 unauthorized` before any statement runs; the branch endpoints apply the same rule. Two internal steps run as the manager's own system principal and return aggregate change counts only: the restore dry run and the branch change counter.
