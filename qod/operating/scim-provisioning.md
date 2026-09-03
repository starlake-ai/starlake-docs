---
id: scim-provisioning
title: SCIM provisioning
---

Quack-on-Demand exposes a SCIM 2.0 (RFC 7643/7644) endpoint set so an enterprise IdP (Okta, Microsoft Entra, Google) can provision, update, and deprovision users and groups automatically. It complements per-tenant OIDC SSO: SSO authenticates people, SCIM keeps the tenant's user and group inventory in sync with the IdP directory. Available since 0.7.2.

The base URL is per tenant:

```
https://<manager>/api/scim/v2/<tenant>
```

`<tenant>` accepts either the tenant's surrogate id (`t-...`) or its display name; the tenant perimeter is enforced on every call, so a connector configured for tenant A can never read or write tenant B.

---

## Authentication

The IdP connector authenticates with `Authorization: Bearer <token>`, where the token is the static `QOD_API_KEY` or a personal access token. Bearer is accepted on the `/api/scim/` prefix only; nothing else on `/api` takes it. The usual `X-API-Key` header and session cookie also work, but IdP connectors send Bearer, so a PAT is the recommended credential: it can be revoked independently of the static key.

```bash
curl -s https://manager.example.com/api/scim/v2/acme/Users \
  -H "Authorization: Bearer $TOKEN"
```

## Resources and operations

- **Users** and **Groups**: create, read, list, replace (PUT), PATCH, and DELETE.
- **Discovery**: `ServiceProviderConfig`, `ResourceTypes`, and `Schemas`, so connectors can self-configure.
- **Filtering**: the `attr eq "value"` shape IdPs actually send - `userName` and `externalId` on Users, `displayName` and `externalId` on Groups. Other filter shapes are refused with a SCIM error envelope.
- **Pagination**: `startIndex` (1-based) and `count` (default 100, capped at 500).
- **PATCH**: the standard ops, including the `active` toggle (Entra's string booleans `"True"`/`"False"` are handled) and group member `add` / `remove` / `replace`, including the `members[value eq "..."]` filter path.

## Attribute mapping

| SCIM attribute | QoD field | Notes |
|---|---|---|
| `userName` | `username` | Immutable after create; the row key. |
| `active` | `enabled` | `false` cuts both the REST login and the FlightSQL handshake. |
| `emails` (primary) | `email` | The email policy applies: an email-format `userName` fixes `email` to itself. |
| `externalId` | `external_id` | Written only by SCIM; round-trips for connector reconciliation. |
| Group `displayName` | group name | Immutable after create. |
| Group `members` | user-group membership | Drives the RBAC closure like any other membership edge. |

## Behavior notes

- **The superuser realm is invisible.** Rows with `tenant IS NULL` are never listed, matched, or writable through SCIM; the endpoint only ever sees the tenant's own principals.
- **Passwordless creates get an unguessable random password.** IdP-provisioned users are expected to sign in through the tenant's OIDC SSO, not with a password. Supplying a `password` on create is still allowed.
- **SCIM manages identity, not privileges.** What a provisioned user may do still comes from the RBAC graph: link the SCIM-managed groups to roles with [group-role grants](/qod/operating/rbac-admin), and the IdP adding someone to a group is then enough to grant access.
- **Deprovisioning**: the connector's DELETE removes the user; flipping `active` to `false` disables login while keeping the row (the usual soft-deprovision IdPs prefer).

## Connector setup

Point the IdP's SCIM integration at the tenant base URL and give it the Bearer token:

- **Okta**: SCIM connector base URL `https://<manager>/api/scim/v2/<tenant>`, authentication mode "HTTP Header" with the token.
- **Microsoft Entra**: enterprise application provisioning, tenant URL as above, secret token = the PAT. Entra's non-standard string booleans on `active` are accepted.

Pair provisioning with the tenant's SSO configuration (see [Authentication providers](/qod/operating/auth-providers)) so provisioned users can actually sign in.
