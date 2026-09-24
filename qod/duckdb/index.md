---
title: "DuckDB as a service: what Quack on Demand adds"
sidebar_label: Overview
slug: /duckdb
description: "DuckDB is an embedded engine with no users, no server and no grants. Quack on Demand adds authentication, SSO, access control, ADBC and Flight SQL."
keywords: [duckdb as a service, duckdb server, duckdb gateway, duckdb access control, duckdb adbc, duckdb sso, multi-tenant duckdb, ducklake]
---

DuckDB is an embedded analytical engine: it runs inside your process, trusts whoever opened it, and has no network listener, no users and no grants. Quack on Demand keeps DuckDB as the engine and adds the service layer around it, so many people and tools can query shared DuckDB and DuckLake data with identity, authorization and scale.

## What a single DuckDB does not give you

| You need | A single DuckDB | Behind Quack on Demand |
| --- | --- | --- |
| A server other machines can reach | No listener | Arrow Flight SQL on `:31338` and native Quack on `:9494` |
| Users and passwords | None | Built-in accounts, JWT, OAuth and OIDC providers |
| Single sign-on | None | Keycloak, Google, Azure AD, Cognito, Okta via OIDC, plus SCIM |
| Grants, row filters, column masks | None | Roles, table verbs, row-level policies, column masking |
| Several teams on one deployment | One file, one process | Tenants, databases and pools, isolated at the edge |
| JDBC, ODBC, ADBC drivers | Local bindings only | Standard Flight SQL drivers for BI tools and notebooks |
| More than one machine | One process | Pools of DuckDB nodes that scale out and suspend when idle |

## How to read this section

Each page below answers one question in the words people search for, shows the mechanism with one example, and links into the operator and concept pages for the full detail.

- [DuckDB access control](/qod/duckdb/access-control): roles, grants, row and column security.
- [DuckDB authentication](/qod/duckdb/authentication): passwords, tokens and OAuth for SQL clients.
- [DuckDB single sign-on](/qod/duckdb/sso): Keycloak, Google, Azure AD and Okta.
- [Connect with ADBC](/qod/duckdb/adbc): Python, Go and Power BI.
- [A Flight SQL server for DuckDB](/qod/duckdb/flight-sql-server): JDBC, ODBC and ADBC.
- [Multi-tenant DuckDB](/qod/duckdb/multi-tenant): tenants on a shared DuckLake.

Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets. Start with the [Quickstart](/qod/getting-started/quickstart), or read the [Architecture](/qod/concepts/architecture) for how the pieces fit.
