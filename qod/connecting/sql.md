---
id: sql
title: "Supported SQL: the DuckDB dialect through the gateway"
sidebar_label: "Supported SQL"
description: "What SQL you can run through the DuckDB gateway: the DuckDB dialect, default schema rules, transactions, prepared statements and authorization."
keywords: ["duckdb sql", "supported sql", "transactions", "prepared statements"]
---

Each Quack node is a DuckDB engine over a DuckLake catalog, so the dialect a client sees is DuckDB SQL. What you can run is whatever DuckDB supports, subject to the routing and authorization the gateway applies. This page covers the behaviors that differ from talking to a single DuckDB directly.

## Dialect

Statements are executed by DuckDB on the chosen node, so DuckDB syntax, functions, and types apply, including its `FROM`-first shorthand (`FROM t SELECT ...`). Beyond the default-schema prefix described below, the gateway leaves your SQL untouched - unless [column- or row-level security](/qod/operating/rbac-model) is enabled, in which case a matching `SELECT` is rewritten to mask columns or filter rows before it reaches the node.

## Unqualified names and the default schema

A connection is scoped to a pool, and the pool is bound to one database with a default catalog and schema. The gateway prepends `USE <catalog>.<schema>;` to each statement, so an unqualified `SELECT * FROM customer` resolves against the pool's database, and `tpch1.customer` (schema-qualified) works too. The prefix is skipped when your statement itself starts with `USE`, `SET`, `BEGIN`, `COMMIT`, `ROLLBACK`, `ATTACH`, or `DETACH`, so you can drive the session explicitly when needed. The mechanics are in [Routing and statement classification](/qod/concepts/routing).

Names resolve exactly as DuckDB resolves them, and are authorized as resolved. One exception: for a principal holding row or column policies, a two-part name whose first part names a possibly-attached catalog (the tenant-db itself, e.g. `acme_tpch`, any federation alias, or the DuckDB built-ins `memory` / `system` / `temp`) is denied as ambiguous, and you must write the full three-part form, e.g. `acme_tpch.tpch1.customer`. See [Table name resolution](/qod/administration/access-control#table-name-resolution).

## Transactions

`BEGIN` / `COMMIT` / `ROLLBACK` are supported. A transaction pins to the node its `BEGIN` ran on, and every statement until `COMMIT` / `ROLLBACK` routes to that node. If that node is lost mid-transaction, the transaction fails explicitly and must be restarted, there is no silent re-execution on another node. See [Sessions and transactions](/qod/concepts/sessions-transactions) for the full model.

## Prepared statements

Prepared statements are supported with two caveats in this version:

- They are effectively single-use: the statement is executed when it is prepared (so the result schema is known to JDBC/ADBC) and the result is replayed once.
- Parameter bindings are not supported; a prepared statement is a fixed SQL string.
- A FlightSQL session's prepared statements are dropped when the session ends, and one left unused for the session TTL (`QOD_SESSION_TTL_SEC`, default 1 h); using it then answers "no such prepared statement", so the client prepares again.

For repeated parameterized queries, send each as its own statement rather than re-binding a prepared handle.

## Authorization

Every statement is checked against the connecting principal's effective permissions by the node that runs it, on the plan DuckDB bound, before it executes; there is no switch to turn this off. A statement that touches a table the principal cannot access is refused and never runs: FlightSQL `UNAUTHORIZED`, with a reason such as `access denied: Permission Error: QoD: user:alice lacks grants on acme_tpch.tpch1.lineitem:read`. A statement refused because no decision could be had in time reads `QoD: authorization unavailable, retry` and is retryable (FlightSQL `UNAVAILABLE`). The verb and table model is described in the [Access control model](/qod/operating/rbac-model).

What a tenant user (not a superuser) cannot run, whatever the grants:

- DuckDB's built-in listing views: `pg_catalog.*`, `sqlite_master`, `system.information_schema.*`, bare `SHOW` / `DESCRIBE`, `SHOW TABLES FROM ...`, `SHOW SCHEMAS`, `SHOW DATABASES`, `SHOW VARIABLES`. Use `information_schema.tables` / `columns` / `schemata` / `views`, `duckdb_tables()` and its siblings, `SHOW TABLES` and `DESCRIBE <table>`, which are filtered to the user's grants.
- A function the classification does not list (`QoD: function <name> is not classified`), `current_setting()`, `CREATE MACRO`, triggers, `ATTACH`, secrets, extension `INSTALL` / `LOAD`, and node-wide settings.
- A file by path outside the user's own S3 keys (`qod profile s3 add`) and the tenant's authorized folders; a file in a table position (`FROM 'x.parquet'`) is "table not found": use the reader function (`read_parquet('...')`).

See [Hardening](../operating/hardening.md#node-enforcement-always-on) for the full list.

## Querying federated catalogs

If the database has federated sources attached, their catalogs appear under their aliases, and you query them like any other table with a three-part `alias.schema.table` reference (for example `SELECT * FROM fedpg.public.orders`). For a principal holding row or column policies, the three-part form is the only accepted one: a two-part reference whose first part is a federation alias is denied as ambiguous (see [Table name resolution](/qod/administration/access-control#table-name-resolution)). Access is governed by the same grants: reads need an `RO` (SQL `SELECT`) grant naming the federated alias, since a wildcard catalog grant never covers it, and writes need an `RW` (or `DDL`, or `ALL`) grant, exactly as for a native table. A source marked read-only refuses writes to everyone, superusers included; Iceberg sources are read-only by default, free-form `sql` sources are not. Setting up federated sources is covered in [Federation](/qod/operating/federation).
