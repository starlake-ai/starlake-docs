---
id: duckdb
title: DuckDB (native Quack protocol)
sidebar_label: DuckDB (native Quack)
description: "ATTACH a governed DuckDB gateway from any DuckDB client with the quack extension, no driver required, and join remote tables with local ones."
keywords: ["duckdb attach", "quack protocol", "duckdb client server", "duckdb remote"]
---

Besides Arrow Flight SQL, the manager serves DuckDB's own **Quack** protocol on a dedicated
listener (default port `9494`). Any DuckDB 2.0 (2.0.0 or 2.0.1) that carries the `quack`
extension, the CLI, the Python package, an embedded DuckDB, attaches the gateway as a database
with no driver in between, and can join the attached catalog with its local tables in one query.

```sql
ATTACH 'quack:qod.example.com:9494' AS qod
  (TYPE quack, TOKEN 'tenant=acme&pool=bi&user=alice&password=demo-alice');

SELECT s.label, count(*) AS customers
FROM qod.tpch1.customer c JOIN my_local_segments s ON c.c_mktsegment = s.segment
GROUP BY 1 ORDER BY 2 DESC;

-- one shot, no ATTACH
SELECT * FROM quack_query('quack:qod.example.com:9494', 'SELECT count(*) FROM tpch1.orders',
  token := 'tenant=acme&pool=bi&user=alice&password=demo-alice');
```

What applies is exactly what applies to a FlightSQL client: the same handshake gates (tenant
scope, pool grant), per-statement [routing](/qod/concepts/routing) across the pool, the nodes'
[grant check](../operating/rbac-model.md), column masking and row filters, metadata filtering,
author stamping, statement history, the [audit log](/qod/administration/audit-log) (origin
`quack`), kill, and scale-to-zero wake-up. The manager relays each statement to a node and
hands the node's result back to the client byte for byte; it never re-encodes data.

## The token

The Quack wire carries one opaque token string and no user identity. QoD defines the token as
the same parameters a FlightSQL JDBC URL takes after `?`, percent-encoded:

| Form | Token |
|---|---|
| Password | `tenant=<tenant>&pool=<pool>&user=<user>&password=<password>` |
| OIDC bearer | `tenant=<tenant>&pool=<pool>&token=<jwt>` |
| Superuser (system realm) | append `&superuser=true` |

`tenant` accepts the display name or the surrogate id (`t-<8 hex>`), like the Flight header.
A password containing `&`, `=` or `%` is percent-encoded. Personal access tokens are not
accepted on this wire (the same rule as FlightSQL); use a user and password or an OIDC bearer.

The token can be passed three ways, all DuckDB-native:

```sql
-- inline on ATTACH
ATTACH 'quack:host:9494' AS qod (TYPE quack, TOKEN '...');
-- inline on quack_query
SELECT * FROM quack_query('quack:host:9494', 'SELECT 1', token := '...');
-- through a DuckDB secret scoped to the endpoint (the ATTACH then needs no TOKEN)
CREATE SECRET qod (TYPE quack, TOKEN '...', SCOPE 'quack:host:9494');
ATTACH 'quack:host:9494' AS qod (TYPE quack);
```

A malformed token or a bad password answers `Authentication failed: ...` at `ATTACH` time; a
valid principal with no grant on the pool answers `permission denied: ...`.

## ATTACH options

Besides `TYPE quack`, the `quack` extension of a DuckDB 2.0.1 client takes only `TOKEN`,
`SECRET`, `DISABLE_SSL`, `SSL_FINGERPRINT`, `CLIENT_ID` and `HEARTBEAT_TIMEOUT`. Any other option
fails on the client, before it connects, with `Unrecognized option for attach "<name>"`, and
`READ_ONLY` with `READ_ONLY is not currently supported for Quack databases`. So attach without
`READ_ONLY`, and make the access read-only through the user's grants instead: a user holding only
`RO` grants can read and never write (see the [Access control model](../operating/rbac-model.md)).

## TLS and remote hosts

The DuckDB client speaks plain HTTP to `localhost` / `127.0.0.1` / `::1` and TLS to every
other host, and cannot be told to use TLS on a loopback host. The listener is therefore plain
HTTP by default (`QOD_QUACK_TLS_ENABLED=false`). Before exposing it beyond the host, either:

- set `QOD_QUACK_TLS_ENABLED=true` (the FlightSQL edge's certificate pair is reused by
  default; the DuckDB client does not verify self-signed certificates unless told to), or
- terminate TLS in front of the port, as you would for the REST API.

A remote client talking to a plain-HTTP listener adds `DISABLE_SSL true` to the `ATTACH`
options (`disable_ssl := true` on `quack_query`). See [TLS](/qod/operating/tls) for the knobs.

## What the client sees

- **Statements route per statement.** As on the Flight edge, each statement lands on a node
  picked by the router (reads on readers, writes on writers). Session state outside an explicit
  transaction (`SET`, temp tables) does not carry over between statements.
- **Transactions.** `BEGIN; ...; COMMIT` from a DuckDB client runs on one node connection, so a
  client transaction is a real transaction on one node (the Flight edge only pins the node; see
  [Sessions and transactions](/qod/concepts/sessions-transactions)). A transaction that cannot go
  on is ended rather than moved: a statement refused inside it (a grant revoked mid-transaction
  included), or its node leaving the pool (scale down, failure, restart), answers
  `transaction aborted: <reason>; ROLLBACK to continue` for that statement and every later one
  until the client's `ROLLBACK`.
- **Writes.** `INSERT INTO qod.<schema>.<table> ...` from local data is judged by the node as a
  write on that table, and is author-stamped like a FlightSQL write. Reading the client's local
  table this way (`scan_data_from_quack_client`) works only on this wire, scoped to the client's
  own connection; the same statement sent over FlightSQL is refused, superusers included.
- **Denials** answer inside DuckDB's error text with the node's refusal, which reads
  `QoD: <reason>` (for example `Permission Error: QoD: user:alice lacks grants on ...`). A
  statement refused because no verdict could be had in time reads
  `QoD: authorization unavailable, retry` and can be retried.
- **Catalog browsing.** The client bootstraps its catalog view with `information_schema` and
  `duckdb_tables()` queries, which are always filtered: a user only sees the objects they hold a
  grant on. DuckDB's unfiltered listing views (`pg_catalog.*`, `sqlite_master`, bare `SHOW` /
  `DESCRIBE`, `system.information_schema.*`) are refused to every user who is not a superuser;
  `SHOW TABLES` and `DESCRIBE <table>` of a granted table keep working.

## Operations

- **Configuration:** the `quack-native` block (`QOD_QUACK_ENABLED`, `QOD_QUACK_HOST`,
  `QOD_QUACK_PORT`, `QOD_QUACK_TLS_ENABLED`, `QOD_QUACK_TLS_CERT_CHAIN`,
  `QOD_QUACK_TLS_PRIVATE_KEY`, `QOD_QUACK_MAX_HEARTBEAT_SEC`, `QOD_QUACK_MAX_BODY_BYTES`); see
  the [configuration reference](/qod/reference/configuration#quack-native). Session TTL and the
  scale-to-zero resume hold reuse `quack-flightsql.sessionTtlSec` and `resumeHoldTimeoutSec`.
- **Ports:** Docker exposes `9494` (`QUACK_PORT` in the compose file); the Helm chart adds a
  `<release>-quack` Service (`service.quack.*`, `quack.enabled`, `quack.tls.enabled`).
- **HA:** Quack sessions are per manager replica, like FlightSQL sessions. Under HA, put a
  session-sticky balancer in front of the port; a client whose next request lands on another
  replica gets `Invalid connection id` and must re-attach.
- **The boot banner, `qod serve` and the pool page** print the ready-to-paste `ATTACH` string.

## Client versions

The front door speaks Quack protocol 3, the protocol of DuckDB 2.0: DuckDB 2.0.0 and 2.0.1
clients both reach it. A DuckDB 1.x client is refused at `ATTACH` with
`quack-on-demand requires a DuckDB 2.0 client (Quack protocol 3); this client (<version>) speaks
<min>..<max>`: upgrade it to DuckDB 2.0.

Clients that send each statement as `<alias>.query('<sql>')` on the attached catalog, such as
Columnar's `quack` ADBC driver, work like any other: the filtered `duckdb_schemas()` always
lists the session catalog's `main` schema, through which the DuckDB client binds that `query`
macro, even for a user holding no grant in it; the tables in it stay filtered.
