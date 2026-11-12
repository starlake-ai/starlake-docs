---
id: drivers
title: "Drivers and connectors: what to download for each client"
sidebar_label: "Drivers and downloads"
description: "Where to download every driver and connector that connects to DuckDB through Quack on Demand: the QoD JDBC driver, the Arrow Flight SQL JDBC driver, the Power BI connector, ADBC, ODBC, DuckDB and the qod CLI."
keywords: ["duckdb jdbc driver download", "flight sql odbc driver", "adbc flight sql", "power bi duckdb connector", "qod.mez", "duckdb driver"]
---

Quack on Demand serves queries on two wires: Arrow Flight SQL (`:31338`) and DuckDB's own Quack protocol (`:9494`). Every client below speaks one of them. QoD itself ships the JDBC driver with browser sign-in, the Power BI connector and the `qod` CLI; everything else is a standard driver from its own project.

## By client

| Client | Download | Then |
|---|---|---|
| DBeaver, DataGrip, any JDBC tool, with sign-in at your identity provider | [QoD JDBC driver](#qod-jdbc-driver) | [QoD JDBC driver](./jdbc-driver.md) |
| DBeaver, Spark, any JDBC tool, with a password or a token | [QoD JDBC driver](#qod-jdbc-driver) or the [Arrow Flight SQL JDBC driver](#arrow-flight-sql-jdbc-driver) | [DBeaver](./dbeaver.md), [Connecting clients](./clients.md#dbeaver-and-jdbc) |
| Tableau Desktop | [Arrow Flight SQL JDBC driver](#arrow-flight-sql-jdbc-driver) | [Tableau](./tableau.md) |
| Power BI Desktop, Microsoft Fabric | [Power BI connector](#power-bi-connector-qodmez) | [Power BI](./powerbi.md) |
| Python, Go, R and other ADBC clients | [ADBC Flight SQL driver](#adbc-flight-sql-driver) | [Connecting clients](./clients.md#python-adbc--pyarrow) |
| ODBC tools | [A Flight SQL ODBC driver](#flight-sql-odbc-driver) | [Connecting clients](./clients.md#odbc) |
| DuckDB (CLI, Python, embedded) | [DuckDB 2.0](#duckdb) | [DuckDB (native Quack)](./duckdb.md) |
| A terminal, scripts, operators | [The qod CLI](#the-qod-cli) | [CLI](../cli/index.md) |
| AI agents (Claude Code, Claude Desktop, Cursor) | Nothing: the manager serves MCP | [MCP server](./mcp.md), [Operator skill](./agent-skill.md) |

## QoD JDBC driver

One jar, `qod-jdbc-<version>.jar`, from the [latest release](https://github.com/starlake-ai/qod-jdbc/releases/latest), with its SHA-256 beside it. It is the Arrow Flight SQL JDBC driver, bundled unchanged and with the same version, plus `authenticator=externalbrowser`. Use it in place of the Arrow driver jar, not next to it. Driver class `ai.starlake.qod.jdbc.QodDriver`, URL `jdbc:qod://<host>:31338?...`; Java 11 or later.

## Arrow Flight SQL JDBC driver

Apache's driver, `org.apache.arrow:flight-sql-jdbc-driver`, from [Maven Central](https://central.sonatype.com/artifact/org.apache.arrow/flight-sql-jdbc-driver): pick a version and download its jar (`flight-sql-jdbc-driver-<version>.jar`), or let a tool fetch it by that coordinate, as DBeaver's Driver Manager does. Driver class `org.apache.arrow.driver.jdbc.ArrowFlightJdbcDriver`, URL `jdbc:arrow-flight-sql://<host>:31338?...`.

## Power BI connector (`QoD.mez`)

From the [qod-powerbi-connector releases](https://github.com/starlake-ai/qod-powerbi-connector/releases), two files per release:

- `QoD-<version>.mez`, unsigned: loads once Power BI's data-extensions security setting is lowered;
- `QoD-<version>.pqx`, signed: loads under the recommended setting once you trust its certificate.

Power BI Desktop 2.145.1105.0 (July 2025) or later carries the Flight SQL ADBC driver the connector uses, so there is nothing else to install. For OAuth, build the connector from source with your identity provider compiled in; the [Power BI](./powerbi.md) page has both paths.

## ADBC Flight SQL driver

For Python, from PyPI:

```bash
pip install adbc-driver-flightsql adbc-driver-manager
```

Go, R, Java and C/C++ have their own packages of the same driver: see the [ADBC project](https://arrow.apache.org/adbc/).

## Flight SQL ODBC driver

QoD ships no ODBC driver; any Arrow Flight SQL ODBC driver connects. The usual one is Dremio's open source driver: see [Downloading and installing](https://docs.dremio.com/current/client-applications/drivers/arrow-flight-sql-odbc-driver#downloading-and-installing) in Dremio's documentation, which covers Windows (64-bit only), Linux and macOS. The DSN settings QoD needs are on [Connecting clients](./clients.md#odbc).

## DuckDB

Any DuckDB 2.0 with the `quack` extension attaches the gateway itself, with no driver: the CLI or a client library from [DuckDB's installation page](https://duckdb.org/docs/installation/), or `pip install duckdb` for Python.

## The qod CLI

From PyPI, on Linux, macOS and Windows:

```bash
pip install qod        # or, without installing: uvx qod@latest <command>
```

It runs SQL (`qod sql`) as well as every administration command.
