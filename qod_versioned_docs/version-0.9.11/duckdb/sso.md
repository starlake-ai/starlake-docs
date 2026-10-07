---
title: "DuckDB single sign-on with Keycloak, Google, Azure AD and Okta"
sidebar_label: Single sign-on
description: "Single sign-on for DuckDB: Keycloak, Google, Azure AD or Cognito tokens for SQL clients, any OIDC IdP including Okta for the admin UI, plus SCIM sync."
keywords: [duckdb sso, duckdb single sign-on, duckdb oidc, duckdb keycloak, duckdb azure ad, duckdb okta, duckdb google login, duckdb scim]
---

Single sign-on for DuckDB means a user opens Power BI, DBeaver or a notebook and authenticates with the company identity provider, not with a password stored in a file. Quack on Demand does this with OIDC bearer tokens for SQL clients, OIDC discovery for the admin UI, and SCIM to keep users and groups in sync.

## The problem

Enterprise IT will not hand out shared passwords for a data endpoint. They want the identity provider they already run, Keycloak, Google Workspace, Microsoft Entra, Okta or Cognito, to decide who can log in, to revoke access centrally, and to provision and deprovision accounts automatically. A single DuckDB has no place to plug that in.

## How Quack on Demand does it

For the SQL wire, enable one or more OIDC providers. The gateway derives the JWKS endpoint, verifies each bearer token's signature, issuer and audience, and maps the user to a tenant. Each tenant selects its own provider, so one deployment can serve a Keycloak tenant and a Google tenant side by side. Clients that can only send a username and password, such as JDBC drivers, get a token through the resource owner password grant on Keycloak or Azure AD. Google users get a token from the browser token page, and Cognito users get one from Cognito directly.

```bash
QOD_AUTH_KEYCLOAK_ENABLED=true
QOD_AUTH_KEYCLOAK_BASE_URL=https://keycloak.example.com
QOD_AUTH_KEYCLOAK_REALM=your-realm
QOD_AUTH_KEYCLOAK_CLIENT_ID=quack-client
QOD_AUTH_KEYCLOAK_CLIENT_SECRET=client-secret
```

For the admin UI, a separate provider-agnostic switch uses OIDC discovery: configure an issuer URL and a client id and secret, and the manager resolves the authorize, token and JWKS endpoints itself, so any compliant IdP works. Groups can be enriched from Google Workspace or read from token claims. SCIM 2.0 endpoints per tenant let Okta, Entra or Google provision and deprovision users and groups without anyone touching the gateway. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Authentication providers](/qod/operating/auth-providers): Keycloak, Google, Azure AD, Cognito, the browser token page and admin UI SSO.
- [OAuth / OIDC server setup](/qod/operating/oauth-server-setup): redirect URIs, client registration, worked Power BI via Keycloak example.
- [SCIM provisioning](/qod/operating/scim-provisioning): the endpoints and connector setup.
- [Authentication](/qod/operating/authentication): how claims become roles and groups.
