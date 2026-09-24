---
title: "A Flight SQL server for DuckDB: JDBC, ODBC and ADBC"
sidebar_label: Flight SQL server
description: "DuckDB has no server. Quack on Demand is an Arrow Flight SQL server for DuckDB and DuckLake, so DBeaver, Tableau and Power BI connect over JDBC, ODBC or ADBC."
keywords: [duckdb flight sql, duckdb server, arrow flight sql server, duckdb jdbc, duckdb odbc, duckdb remote access, duckdb network, duckdb client server]
---

DuckDB does not ship a server: it is a library, and its bindings open a database inside your process. Quack on Demand is an Arrow Flight SQL server for DuckDB and DuckLake, which means every tool that carries a Flight SQL driver, JDBC, ODBC or ADBC, connects to shared DuckDB data the way it connects to any warehouse.

## The problem

BI tools, SQL editors and services on other machines need a network endpoint and a standard driver. Serving a DuckDB file over HTTP or a filesystem share gives you neither: each client still runs its own engine, sees a stale or locked file, and carries no identity. You want one endpoint, one identity model, and drivers your tools already have.

## How Quack on Demand does it

One command boots the manager, the Flight SQL edge on `:31338`, DuckDB's native Quack listener on `:9494` and the admin UI, then prints ready-to-paste connection strings for every driver family:

```bash
uvx qod@latest serve --demo
#   JDBC : jdbc:arrow-flight-sql://localhost:31338/?tenant=<tenant>&pool=<pool>&user=<user>&useEncryption=true&disableCertificateVerification=true
#   ADBC : uri=grpc+tls://localhost:31338  (adbc_driver_flightsql)
#   ODBC : Driver={Arrow Flight SQL ODBC Driver};Host=localhost;Port=31338;...
#   DuckDB: ATTACH 'quack:localhost:9494' AS qod (TYPE quack, TOKEN 'tenant=<tenant>&pool=<pool>&user=<user>&password=<password>');
```

The JDBC driver is the Apache Arrow Flight SQL JDBC driver from Maven Central, which DBeaver, Tableau and Spark load directly. ADBC uses the Flight SQL driver that Power BI ships in-box. ODBC uses any third-party Flight SQL ODBC driver. Behind the edge, statements are classified read or write and routed to the least-loaded DuckDB node in the pool, with transactions pinned to one node. TLS is on by default. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Connecting clients](/qod/connecting/clients): the connection target, JDBC, Python, Go and ODBC recipes.
- [DBeaver](/qod/connecting/dbeaver), [Tableau](/qod/connecting/tableau), [Power BI](/qod/connecting/powerbi): per-tool walkthroughs.
- [DuckDB (native Quack)](/qod/connecting/duckdb): the driverless path for DuckDB itself.
- [Routing and statement classification](/qod/concepts/routing): how a statement picks a node.
- [Quickstart](/qod/getting-started/quickstart): boot, connect, query.
