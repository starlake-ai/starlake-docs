---
title: "DuckDB authentication: passwords, tokens and OAuth for SQL clients"
sidebar_label: Authentication
description: "Give DuckDB a login. Quack on Demand authenticates every JDBC, ADBC, ODBC or native DuckDB connection with passwords, JWT bearer tokens or OAuth."
keywords: [duckdb authentication, duckdb auth, duckdb login, duckdb password, duckdb bearer token, duckdb oauth, duckdb jwt, flight sql authentication]
---

DuckDB has no login: opening the file is the credential. Quack on Demand authenticates every connection at the edge, with a built-in password store, external JWT bearer tokens, or OAuth and OIDC providers, before a single statement is routed to a DuckDB node.

## The problem

As soon as DuckDB data is reachable over a network, you need to know who is asking. A shared file or an unauthenticated proxy gives everyone the same identity, which makes access control, auditing and per-user row filters impossible. BI tools expect a username and password or a bearer token in the connection dialog, and notebooks expect the same in a connection string.

## How Quack on Demand does it

Every connection carries a tenant and a pool, and the edge validates the credential against that tenant's configured provider. Providers can be enabled together, and the first to accept wins:

- **Database**: username and password checked with bcrypt against the built-in user table. On by default.
- **External JWT**: a bearer token signed by keys you configure.
- **Keycloak, Google, Azure AD, AWS Cognito**: OIDC bearer tokens verified against the provider's JWKS. Keycloak and Azure AD also accept a username and password from JDBC tools through the resource owner password grant. Google users get a token from the browser token page, and Cognito users get one from Cognito directly.

Roles and groups can be read from token claims, and the resulting session is cached for a configurable TTL. A JDBC client passes the credential in the URL; ADBC and raw Flight clients pass it as headers:

```
jdbc:arrow-flight-sql://gateway:31338?useEncryption=true&user=alice&password=demo-alice&tenant=acme&pool=bi
```

Superusers authenticate against the manager's global providers with `superuser=true` and bypass the per-statement gate. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Authentication](/qod/operating/authentication): realms, the provider chain, claims to roles, sessions.
- [Authentication providers](/qod/operating/auth-providers): enabling and configuring each provider.
- [Authenticating a client](/qod/connecting/authenticating): the client side, credentials and TLS.
- [OAuth / OIDC server setup](/qod/operating/oauth-server-setup): the identity-provider side, per provider.
- [TLS](/qod/operating/tls): certificates on the Flight SQL and native listeners.
