---
id: rest-data-edge
title: "REST data edge: read DuckDB tables over plain HTTP"
sidebar_label: "REST data edge (HTTP)"
description: "Serve governed DuckDB tables and views read-only over HTTP, as JSON or CSV, for n8n, Zapier, spreadsheets and caches: endpoints, filters, paging, tokens, limits and exposure."
keywords: ["duckdb rest api", "duckdb http", "read-only rest", "n8n duckdb", "zapier duckdb", "csv export", "personal access token"]
---

The REST data edge serves tables and views read-only as HTTP resources, for clients that speak HTTP and nothing else: n8n, Zapier, a spreadsheet import, a cache or a CDN. It needs no driver and accepts no SQL.

Each `GET` becomes one `SELECT` that runs through the same grants, row and column policies, pool permissions, audit, statement history and row caps as every other door (the FlightSQL edge, the native Quack front door, MCP). Nothing is writable. Statements carry the origin `rest-data` in audit and history, with the token's id, and OPA sees `client.edge = "rest-data"`.

## Enable it

The edge is off by default. Turn it on in the manager's environment:

```bash
QOD_DATA_EDGE_ENABLED=true
```

With Helm, set `dataEdge.enabled=true`. The edge needs no Service, port or NetworkPolicy rule of its own: it is served under `/data/v1` on the manager port (`:20900`), plain HTTP like the rest of the manager. TLS is the reverse proxy's (see [Exposing the data edge](#exposing-the-data-edge)). The boot banner prints a `REST (data)` line when the edge is on.

## Authenticate with a personal access token

The edge accepts exactly one credential: a personal access token in `Authorization: Bearer qod_pat_...`. It never reads the session cookie, the static API key, HTTP Basic, a password or `?access_token=`.

- A superuser's token is refused (401). Mint the token from a tenant user.
- The URL's tenant must be the token owner's tenant, otherwise `403 forbidden`.
- A token with no `tools` restriction may use the edge. A token restricted with `--tool` must list `rest`, the name reserved for this edge.
- The token's other axes apply as everywhere else: `databases`, `pools`, `maxRows` and `stmtTimeoutMs`. See [Scoped tokens and delegation](./mcp.md#scoped-tokens-and-delegation).

Mint a token scoped to the edge and one database, with its own row cap:

```bash
qod auth pat create --name n8n-orders --tool rest --database acme_tpch --max-rows 5000
# {"id":"pat-...","token":"qod_pat_..."}   <- printed once
```

## Endpoints

Every route is a `GET` under `/data/v1/tenant/{tenant}/database/{db}`:

| Route | Answers |
|---|---|
| `/schemas` | The schemas of the database the caller can read: `[{"name"}]` |
| `/schemas/{s}/tables` | The tables and views of schema `s` the caller can read: `[{"name", "type": "table"\|"view"}]`. A schema with nothing visible is a 404. |
| `/schemas/{s}/tables/{t}` | One table or view as the caller sees it after policy: `{"name", "type", "columns": [{"name", "type"}]}` |
| `/schemas/{s}/tables/{t}/rows` | Rows, as JSON or CSV |

```bash
TOKEN=qod_pat_...
BASE=http://localhost:20900/data/v1/tenant/acme/database/acme_tpch

curl -H "Authorization: Bearer $TOKEN" "$BASE/schemas"
curl -H "Authorization: Bearer $TOKEN" "$BASE/schemas/tpch1/tables"
curl -H "Authorization: Bearer $TOKEN" "$BASE/schemas/tpch1/tables/orders"
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/schemas/tpch1/tables/orders/rows?select=o_orderkey,o_totalprice&o_orderstatus=eq.F&order=o_orderkey&limit=100"

# CSV instead of JSON
curl -H "Authorization: Bearer $TOKEN" "$BASE/schemas/tpch1/tables/orders/rows?limit=10&format=csv"
```

Schema and table segments take any name DuckDB can hold (`order-items`, `2024_sales`), so every listed object is readable. Listings are always narrowed to the caller's grants.

### Formats

JSON is an array of objects, with exact decimals. CSV is RFC 4180, with a header row. The format comes from `format=json|csv`, else from the `Accept` header (`application/json`, `text/csv`), else JSON. Anything else is `406 unsupported_format`.

CSV values are written exactly as stored, with no spreadsheet formula escaping: a value starting with `=`, `+`, `-` or `@` reaches a spreadsheet as written, so a consumer that opens CSV in a spreadsheet must guard itself.

## Reading rows

`/rows` takes these parameters:

| Parameter | Meaning |
|---|---|
| `select=a,b` | The columns to return (at most 256). Without it the edge reads the whole row (`SELECT *`), every column the caller may see. |
| `<column>=[not.]<op>.<value>` | A filter on `column`, see below. Repeating a filter ANDs it. At most 32 filters. |
| `order=a.desc.nullslast,b` | Sort terms, `col[.asc\|.desc][.nullsfirst\|.nullslast]`, at most 16. Suffixes are read from the right, so a column name may hold dots. |
| `limit` | Rows per page, default `QOD_DATA_EDGE_DEFAULT_LIMIT` (1000). |
| `offset` | Rows to skip. `offset` above 0 needs `order` (`400 order_required`). |
| `pool=<name>` | The pool to read from. Without it the request goes to a pool the caller may use: among the database's pools, those the token's `pools` axis allows and, when several are left, the first the FlightSQL handshake admits the caller to. |
| `asOf`, `asOfTag`, `asOfTs` | DuckLake time travel, at most one of them. See [Time travel and stable paging](#time-travel-and-stable-paging). |
| `format=json\|csv` | The response format. |

`select`, `order`, `limit`, `offset`, `asOf`, `asOfTag`, `asOfTs`, `pool`, `format` and `branch` are parameters, never filters. Any of them in any case (`Limit`, `ASOF`) with a filter-shaped value (`limit=eq.5`) answers `400 reserved_column` on every table, whether or not it has such a column. With an ordinary value the exact name keeps its meaning (`limit=5`). To filter a column so named, grant a view that renames it. `branch` is refused: branch reads are not supported.

The query string is percent-decoded once, and `+` stays a literal plus, so encode a space as `%20`. A malformed `%` sequence, a NUL byte, or a value over 4096 bytes is `400 invalid_parameter`.

### Filters

| Operator | Example | Meaning |
|---|---|---|
| `eq`, `neq` | `status=eq.F`, `status=neq.F` | `=` and `<>` |
| `gt`, `gte`, `lt`, `lte` | `o_totalprice=gte.1000` | `>`, `>=`, `<`, `<=` |
| `like`, `ilike` | `c_name=like.Customer*`, `c_name=ilike.*smith*` | Pattern match, `ilike` ignoring case. `*` is the wildcard, at most 4 per value. When the value holds a literal `%` or `_`, `*` may only start or end it. |
| `in` | `status=in.(F,O,"a,b")` | One of the items, at most 64. A bare item holds none of `, ( ) "`; a quoted item takes `\"` and `\\` escapes. |
| `is` | `o_comment=is.null` | `is.null`, `is.true` or `is.false`, on any column |

Every operator can be negated with a `not.` prefix: `status=not.in.(X,Y)`, `o_comment=not.is.null`.

A filter value is checked against the column's type. One that the column's real type rejects (a malformed UUID) is `400 invalid_filter`. A UUID, JSON or ENUM column is pattern-matched, range-filtered and ordered as the text it is shown as, while `eq`, `neq` and `in` compare the column itself, so a UUID matches in any case.

### Time travel and stable paging

On a DuckLake table, `asOf=<snapshot id>`, `asOfTag=<tag>` or `asOfTs=<ISO-8601>` reads the table at that snapshot. A page of a table carries `X-QoD-Snapshot`, the snapshot it was read at. Send it back as `asOf` on the next page so writes landing in between do not shift the rows. A page read at the current state while another write committed carries no `X-QoD-Snapshot`: read it again.

- A database that is not DuckLake answers `asOf*` with `400 invalid_kind`.
- A view has no time travel: it carries no `X-QoD-Snapshot`, `asOf*` on it is `400 invalid_selector`, and paging over a view is not stable under concurrent writes.
- A vacuumed snapshot is `410 snapshot_expired`; a timestamp before the first snapshot, or a snapshot beyond the latest, is `422 invalid_snapshot`; an unknown tag is a 404.

`X-QoD-Snapshot` tells any token that can read one table of a DuckLake database when that database was last written to, tables it cannot read included. So do the errors of a selector that does not resolve on a table it can read.

### Response headers

| Header | Meaning |
|---|---|
| `Content-Range` | `<first>-<last>/*`, the rows of this page |
| `X-QoD-Truncated: true` | A server or token cap cut the page (the row cap or the byte cap), not your own `limit` |
| `X-QoD-Snapshot` | The DuckLake snapshot the page was read at |
| `Cache-Control` | `private` with `Vary: Authorization, Accept`. Only a DuckLake read pinned by `asOf` or `asOfTag` is cacheable, for five minutes (`private, max-age=300`); everything else is `private, no-cache`. |
| `X-Request-Id` | A fresh id per request; a client's own is replaced, never echoed |
| `Retry-After` | On every 503, in seconds (5) |

## Limits and settings

A page is capped at `min(limit, QOD_DATA_EDGE_MAX_ROWS, the token's maxRows)` rows, and cut at a row boundary once its body would pass `QOD_DATA_EDGE_MAX_RESPONSE_BYTES`. Both cuts set `X-QoD-Truncated`.

The pages in flight share a fifth of the manager's heap. Past it, a request waits up to its statement bound, then answers `503 edge_busy`. At most `QOD_DATA_EDGE_MAX_CONCURRENT_REQUESTS` edge requests are answered at once, so data traffic cannot take all of the manager listener's work; past it, a request answers `503 edge_busy` at once. The edge's connections count against the manager port's `QOD_REST_MAX_CONNECTIONS` and `QOD_REST_MAX_HEADER_BYTES`.

Each statement is bounded by `min(QOD_DATA_EDGE_STMT_TIMEOUT_SEC, the token's stmtTimeoutMs)`; past it a warm pool answers `504 statement_timeout`. A hibernated pool wakes on the first request. If it is not ready within the resume hold (`PROXY_RESUME_HOLD_TIMEOUT_SEC`, 60 s), the answer is `503 pool_resuming` with `Retry-After: 5`, and so is a request to a cold pool that the edge's own wait cuts short. That is why the statement bound must exceed the resume hold.

The settings live in the `quack-data-edge` block of `application.conf`:

| Env var | Default | Meaning |
|---|---|---|
| `QOD_DATA_EDGE_ENABLED` | `false` | Serve the edge under `/data/v1` on the manager port. |
| `QOD_DATA_EDGE_DEFAULT_LIMIT` | `1000` | Rows per `/rows` page when the request gives no `limit`. At least 1. |
| `QOD_DATA_EDGE_MAX_ROWS` | `100000` | Server row cap for `/rows` and the listings; a request `limit` or a token's `maxRows` can only lower it. At least `QOD_DATA_EDGE_DEFAULT_LIMIT`. |
| `QOD_DATA_EDGE_MAX_RESPONSE_BYTES` | `16777216` (16 MiB) | Largest `/rows` body, from 1024 bytes to 64 MiB. |
| `QOD_DATA_EDGE_STMT_TIMEOUT_SEC` | `90` | Bounded wait per statement, in seconds. Must be greater than `PROXY_RESUME_HOLD_TIMEOUT_SEC`. |
| `QOD_DATA_EDGE_MAX_CONCURRENT_REQUESTS` | `256` | Most edge requests answered at once. At least 1. |

The manager refuses to boot on a value out of range, naming it, for example `quack-data-edge: QOD_DATA_EDGE_STMT_TIMEOUT_SEC (60) must be greater than PROXY_RESUME_HOLD_TIMEOUT_SEC (60)`. A disabled edge is never checked. See the [Configuration reference](../reference/configuration.md#quack-data-edge).

## Errors

Errors are JSON, `{"error": "<code>", "message": "..."}`. A message never carries a filter value.

| Status | Code | When |
|---|---|---|
| 400 | `invalid_filter` | A malformed filter, an unknown operator, or a value the column's type rejects |
| 400 | `unknown_column` | `select`, `order` or a filter names a column the caller does not see |
| 400 | `reserved_column` | A reserved parameter name with a filter-shaped value |
| 400 | `order_required` | `offset` above 0 without `order` |
| 400 | `invalid_selector` | More than one of `asOf`, `asOfTag`, `asOfTs`, a malformed one, or `asOf*` on a view |
| 400 | `invalid_kind` | Time travel on a database that is not DuckLake |
| 400 | `invalid_parameter` | A bad `limit` or `offset`, a parameter (other than a filter) given twice, a cap passed, bad percent-encoding, `branch` |
| 400 | `invalid_request` | A `GET` carrying a body (answered with `Connection: close`) |
| 401 | `unauthorized` | Any credential failure: no header or two, Basic, not a PAT, unknown, revoked or expired token, disabled owner, superuser token. One body for all. |
| 403 | `forbidden` | The URL's tenant is not the token's, or the token's `tools` axis does not list `rest` |
| 403 | `acl_denied` | The node refused the data statement after the edge saw the object |
| 404 | `not_found` | Missing or not readable, see below |
| 405 | `method_not_allowed` | Any method but `GET` |
| 406 | `unsupported_format` | A `format` or `Accept` other than JSON or CSV |
| 410 | `snapshot_expired` | The snapshot was vacuumed |
| 422 | `invalid_snapshot` | A timestamp before the first snapshot, an empty catalog, a snapshot beyond the latest |
| 502 | `upstream_error` | The node failed. The message carries a request id; the manager log has a WARN line under that id. |
| 503 | `pool_resuming` | The pool is waking: retry after `Retry-After` |
| 503 | `pool_unavailable` | The pool cannot serve the request |
| 503 | `edge_busy` | The page budget or the concurrent request cap is full |
| 504 | `statement_timeout` | The statement passed its bound on a warm pool |

A missing object and one the caller may not read answer the same `404`, so a token holder cannot probe what exists. The edge learns an object's columns with a `SELECT * ... LIMIT 0` probe, and until that probe succeeds every refusal is that 404: a database with no pool, a pool the token excludes, the database's kind, a view and a snapshot selector included. The probe is recorded only when refused (history `denied` and a `data-denial` audit row); the data statement and the listings are recorded as usual.

## Policies

Row and column policies apply unchanged, on the node: rows are filtered, masked columns look like ordinary columns of their own type, under their own names. Two consequences are specific to the edge:

- **A column under a deny policy hides its whole table.** The probe's `SELECT *` is refused when any column is denied, so `/tables/{t}` and `/rows` answer 404 for that table while `/tables` still lists it. Grant a view that leaves the denied column out instead; a mask, unlike a deny, keeps the table readable.
- **Column names with a dot, an `@`, a bracket or a quote.** A `select` naming such a column is refused (`403 acl_denied`) to a principal holding a column policy, since the gateway cannot read such a quoted name as DuckDB does: read the whole row instead, which the edge writes as `*`.

Time travel under a policy: a principal with a column or row policy reads a table at a snapshot only when the table, under that name, has always been the same table with the same column names in every snapshot the catalog holds. A table renamed, dropped or recreated since, or with a column renamed or dropped, answers `400 invalid_selector` on `asOf*` until those snapshots expire. Reads at the current state are not affected. See [Earlier snapshots and the change feed](../operating/rbac-model.md#earlier-snapshots-and-the-change-feed).

## Exposing the data edge

The data edge shares the manager port with the admin API (`/api/...`), the console (`/ui/...`), `/mcp`, `/health`, `/ready` and `/metrics`, which all stay internal. Put a reverse proxy in front of the manager port and expose only the `/data/` prefix, plus whatever else you deliberately choose to publish.

- **The proxy terminates TLS** and must **rate-limit per client and per `Authorization` value**. The edge has no per-client throttle, authentication throttle or per-user concurrency cap of its own yet: every bad token costs a control-plane lookup, and a valid token can run heavy reads concurrently, bounded only by the row, byte, time and concurrent request caps.
- **The edge claims everything under `/data/`.** It answers every request under `/data/` itself, a 404 included, so `/data/../api/...` or an encoded `..` never reaches a manager route; a request anywhere else falls through to the manager.
- **Callers inside the network bypass the proxy.** Another pod in the cluster or a host on the same subnet reaches the whole port. A NetworkPolicy or a firewall rule works per port, so it cannot tell `/data/` from the admin API.

### nginx

With nginx, allow only the four data routes, `GET` only, drop the `Cookie` header, buffer responses (a slow client then holds the proxy's buffer, not the manager's page budget), and refuse dot segments and encoded slashes by matching the raw `$request_uri`:

```nginx
# http {} context
map $request_uri $qod_data_route {
    default 0;
    "~^/data/v1/tenant/[^/?#]+/database/[^/?#]+/schemas(/[^/?#]+/tables(/[^/?#]+(/rows)?)?)?(\?.*)?$" 1;
}
map $request_uri $qod_bad_path {
    default 0;
    "~*(^|/)(\.|%2e){1,2}(/|\?|$)|%2f|%5c|\x5c" 1;
}
# Example rates: tune them to your clients.
limit_req_zone $binary_remote_addr zone=qod_data_ip:10m    rate=20r/s;
limit_req_zone $http_authorization zone=qod_data_token:10m rate=10r/s;

server {
    listen 443 ssl;
    server_name data.example.com;
    ssl_certificate     /etc/nginx/tls/data.crt;
    ssl_certificate_key /etc/nginx/tls/data.key;

    location / {
        return 404;
    }

    location /data/ {
        if ($qod_data_route = 0) { return 404; }
        if ($qod_bad_path)       { return 404; }
        limit_except GET { deny all; }
        limit_req zone=qod_data_ip    burst=40 nodelay;
        limit_req zone=qod_data_token burst=20 nodelay;

        proxy_set_header Cookie "";
        proxy_buffering on;
        proxy_read_timeout 120s;   # above QOD_DATA_EDGE_STMT_TIMEOUT_SEC (90 s)
        proxy_pass http://<manager>:20900;   # no URI part: the request URI is passed as sent
    }
}
```

### Managed load balancers and Ingress

Route the same prefix and nothing else:

| Platform | Rule |
|---|---|
| AWS ALB | A listener rule with `path-pattern` `/data/*` and `http-request-method` `GET` forwarding to the manager's target group, and a default action that returns a fixed 404. |
| GCP | A URL map path rule for the prefix `/data/` (`/data/*`) to the manager's backend service, with a default service that is not the manager. |
| Azure | An Application Gateway path rule `/data/*`, or with Application Gateway for Containers (Gateway API) an `HTTPRoute` match `PathPrefix: /data/`. |
| Kubernetes Ingress | `path: /data/` with `pathType: Prefix` (the chart's `ingress` values; its default `path: /` exposes the whole port). |

Managed load balancers do not refuse dot segments and encoded slashes the way the nginx `$request_uri` check does; the edge's claim of every request under `/data/` is the backstop. Rate limiting per client and per `Authorization` value then belongs to the load balancer's WAF or the Ingress controller.
