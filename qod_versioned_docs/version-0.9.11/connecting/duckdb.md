---
id: duckdb
title: DuckDB (native Quack protocol)
sidebar_label: DuckDB (native Quack)
description: "ATTACH a governed DuckDB gateway from any DuckDB client with the quack extension, no driver required, and join remote tables with local ones."
keywords: ["duckdb attach", "quack protocol", "duckdb client server", "duckdb remote"]
---

Besides Arrow Flight SQL, the manager serves DuckDB's own **Quack** protocol on a dedicated
listener (default port `9494`). Any DuckDB that carries the `quack` extension, the CLI, the
Python package, an embedded DuckDB, attaches the gateway as a database with no driver in
between, and can join the attached catalog with its local tables in one query.

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
scope, pool grant), per-statement [routing](/qod/concepts/routing) across the pool, the
[ACL](/qod/operating/rbac-model), column masking and row filters, metadata filtering, lockdown,
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
  [Sessions and transactions](/qod/concepts/sessions-transactions)).
- **Writes.** `INSERT INTO qod.<schema>.<table> ...` from local data is authorized as a write on
  that table before any row reaches a node, and is author-stamped like a FlightSQL write.
- **Denials** answer inside DuckDB's error text with the manager's own wording:
  `access denied: no grant on ...`.
- **Catalog browsing.** The client bootstraps its catalog view with `information_schema` and
  `duckdb_tables()` queries; with filtered metadata on, a user only sees the objects they hold a
  grant on.

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

## Known client limitation

The DuckDB 1.5.4 `quack` extension (`40de7ba`) fails on a multi-column result larger than its
inline batch (about 24k rows) with `Attempted to access index 1 within vector of size 1`. This
happens against a raw `quack_serve` node too, so the gateway cannot mask it. Single-column
results of any size, and multi-column results that fit inline, work.
