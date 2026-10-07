---
title: "Connect to DuckDB with ADBC from Python, Go and Power BI"
sidebar_label: ADBC
description: "Query a shared DuckDB with ADBC over Arrow Flight SQL. Quack on Demand serves the standard Flight SQL ADBC driver for Python, Go and Power BI."
keywords: [duckdb adbc, adbc flight sql, adbc_driver_flightsql, duckdb python client, duckdb go client, power bi adbc, arrow database connectivity duckdb]
---

ADBC, Arrow Database Connectivity, is the Arrow-native way to talk to a database from Python, Go, C++ and Power BI. Quack on Demand exposes DuckDB behind an Arrow Flight SQL endpoint, so the standard Flight SQL ADBC driver connects to it with no DuckDB-specific client and results arrive as Arrow batches with no row conversion.

## The problem

DuckDB's own Python and Go bindings talk to an engine inside your process, not to a shared one on another machine. When the data lives on a server, you want a driver that speaks a standard wire, streams columnar results, and works the same from a notebook, a Go service and Power BI.

## How Quack on Demand does it

The gateway's Flight SQL edge on `:31338` is what the ADBC Flight SQL driver expects. The connection needs a URI, a username and password or bearer token, and two call headers naming the tenant and the pool; the edge applies no defaults. Results are Arrow record batches all the way from the DuckDB node to your DataFrame.

```python
import adbc_driver_flightsql.dbapi as flight_sql
from adbc_driver_flightsql import DatabaseOptions

hdr = DatabaseOptions.RPC_CALL_HEADER_PREFIX.value
conn = flight_sql.connect(
    uri="grpc+tls://gateway:31338",
    db_kwargs={
        "username": "alice",
        "password": "demo-alice",
        DatabaseOptions.TLS_SKIP_VERIFY.value: "true",  # self-signed cert
        hdr + "tenant": "acme",
        hdr + "pool": "bi",
    },
)
cur = conn.cursor()
cur.execute("SELECT count(*) FROM tpch1.customer")
print(cur.fetchall())
```

Power BI Desktop ships the Flight SQL ADBC driver in-box, and the Quack on Demand connector rides it for Import and DirectQuery with query folding. The Go driver takes the same URI and headers. Whatever the client, the per-statement access control, row filters and column masks apply. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Connecting clients](/qod/connecting/clients): the Flight SQL connection target and the ADBC, JDBC and raw Flight header rules.
- [Power BI](/qod/connecting/powerbi): the ADBC-based connector, Import and DirectQuery.
- [Authenticating a client](/qod/connecting/authenticating): passwords, bearer tokens and TLS on the client.
- [Supported SQL](/qod/connecting/sql): the DuckDB dialect through the gateway.
