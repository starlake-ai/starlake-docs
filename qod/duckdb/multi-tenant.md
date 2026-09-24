---
title: "Multi-tenant DuckDB on a shared DuckLake"
sidebar_label: Multi-tenant
description: "Run many teams or customers on one DuckDB deployment. Quack on Demand isolates tenants, databases and pools of DuckDB nodes over a shared DuckLake."
keywords: [multi-tenant duckdb, duckdb multi tenant, duckdb saas, tenant isolation duckdb, ducklake multi-tenant, shared duckdb, duckdb pools]
---

Multi-tenant DuckDB means several teams or customers query one deployment while each sees only its own databases, users and compute. Quack on Demand models that as tenants that own databases (DuckLake catalogs) and pools of DuckDB nodes, and enforces the boundary at the edge on every connection and statement.

## The problem

One DuckDB process serves one file for one caller. Giving each team its own file and its own machine multiplies operations and still shares nothing safely, while putting everyone on one file shares everything. What you want is one governed endpoint where a tenant is a real isolation boundary, compute scales per tenant, and idle tenants cost nothing.

## How Quack on Demand does it

Three nested objects organize the deployment. A **tenant** is the isolation boundary and selects its users' authentication provider. A **tenant-db** is a database: a DuckLake catalog in its own Postgres database with its own data path on the filesystem or an S3-compatible store. A **pool** is a set of DuckDB nodes bound to one tenant-db, and it is what clients connect to. A client names its tenant and pool at connection time; the gateway resolves the database server-side and never trusts token claims for routing.

```sql
ATTACH 'quack:qod.example.com:9494' AS qod
  (TYPE quack, TOKEN 'tenant=acme&pool=bi&user=alice&password=demo-alice');

SELECT count(*) FROM qod.tpch1.orders;
```

Pools scale from an autoscale band, suspend to zero nodes when idle and wake on the first query, so tenants pay for compute only while queries run. Usage is metered per tenant, pool and user, and the audit log and statement history are tenant-scoped. Federation lets a tenant attach Postgres, MySQL, S3 or Iceberg sources under the same access-control model. Quack on Demand runs as a single Docker container on one node, ideal for a single tenant, or on Kubernetes for multi-host fleets.

## Go deeper

- [Tenancy model](/qod/concepts/tenancy): the three levels and how isolation is enforced.
- [Tenants and databases](/qod/operating/tenants-databases): provisioning.
- [Pools and cohorts](/qod/operating/pools-cohorts) and [Autoscaling pools](/qod/operating/autoscaling): compute per tenant.
- [Onboard a tenant](/qod/administration/onboarding): the golden path from sign-in to a working connection string.
- [Usage and accounting](/qod/administration/usage-accounting): metering for chargeback.
