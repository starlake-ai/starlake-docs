---
id: architecture
title: "Architecture of a multi-tenant DuckDB gateway"
sidebar_label: "Architecture"
description: "How QoD puts an authenticated, access-controlled, horizontally scaled SQL surface in front of DuckDB: planes, object model, request flow."
keywords: ["duckdb architecture", "duckdb gateway", "control plane", "data plane", "flight sql", "ducklake"]
---

QoD is a gateway that puts a multi-tenant, access-controlled, horizontally-scaled SQL surface in front of DuckDB. Clients reach it over Arrow Flight SQL or DuckDB's native Quack protocol; either way the gateway authenticates them, authorizes each statement, and routes it to one of many DuckDB Quack nodes backed by shared DuckLake catalogs. This page is the conceptual overview; the pages it links to go deeper, and the [Architecture map](/qod/contributing/architecture-map) covers the codebase for contributors.

## The planes

```diagram
title: QoD at a glance, your tools connect to QoD, which runs each query on a DuckDB node
nodes:
  clients: {label: Your SQL tools, kind: client, detail: "BI tools, Python, JDBC, DuckDB"}
  browser: {label: Browser, kind: browser, detail: admin UI}
  manager: {label: QoD, kind: server, accent: true, detail: [signs users in, applies your access rules, sends each query to a node]}
  n1: {label: DuckDB node, kind: server, accent: true, in: pool}
  n2: {label: DuckDB node, kind: server, accent: true, in: pool}
  n3: {label: DuckDB node, kind: server, accent: true, in: pool}
  pg: {label: PostgreSQL, kind: database, detail: [catalog of your tables, QoD settings]}
  s3: {label: Object storage, kind: bucket, detail: "your data, as Parquet files"}
zones:
  pool: {label: Node pool, detail: add nodes to scale}
edges:
  - "clients -> manager: 31338, 9494 Flight SQL or DuckDB"
  - "browser -> manager: 20900 admin UI"
  - manager -> n1
  - manager -> n2
  - manager -> n3
  - "pool -> pg: catalog"
  - "pool -> s3: data"
```

The system separates a control plane from a data plane:

- **Control plane** - the manager process: a REST API and React admin UI for managing tenants, databases, pools, users, and access control, plus the supervisor that spawns and tracks nodes. Its state lives in the control-plane store (see [State storage](/qod/concepts/state-storage)).
- **Data plane** - the FlightSQL edge, the native Quack front door, and the Quack nodes behind them. This is where queries flow. The edge is stateless per request beyond the session it tracks; the nodes hold the DuckDB engines. Each node runs `qod-node`, QoD's own executable on the official DuckDB release library, which authorizes every statement before it runs.

Both run in a single uber-jar exposing four sockets: the manager REST + UI (`:20900`), the node verdict listener (`:20901`, the REST port plus one), the FlightSQL edge (`:31338`), and the native Quack front door (`:9494`, what a DuckDB client `ATTACH`es to). The Quack nodes listen on their own ports: child processes of the manager on the local runtime, pods on Kubernetes, and one node per joined server in a [fleet](/qod/operating/deploy-fleet).

## The object model

Three nested levels organize everything (see [Tenancy model](/qod/concepts/tenancy)):

- A **tenant** is the isolation boundary and selects its users' auth provider.
- A **tenant-db** is a database: a separate Postgres database holding a DuckLake catalog and a data path (see [DuckLake catalogs](/qod/concepts/catalogs)).
- A **pool** is a set of Quack nodes bound to one tenant-db, and is what clients connect to.

## The request lifecycle

When a client runs a statement, it passes through a fixed sequence:

1. **Authenticate.** The edge validates the connection's credential (database password, JWT, or OIDC) and resolves the target `(tenant, pool)`; the owning tenant-db is resolved server-side. See [Authenticating](/qod/connecting/authenticating).
2. **Rewrite.** For a principal holding row or column policies, the gateway rewrites the statement to filter rows and mask columns. See the [Access control model](/qod/operating/rbac-model).
3. **Classify and route.** The statement is classified read / write / DDL and dispatched to the least-loaded node whose role can serve it (on object-store pools, biased toward a node that already has its tables cached); an open transaction pins to its node. See [Routing](/qod/concepts/routing) and [Sessions and transactions](/qod/concepts/sessions-transactions).
4. **Authorize on the node.** The manager first installs a signed session handle naming the principal on the node connection. The node binds the statement, describes the plan (tables, views and columns, functions, settings, files) and, for a principal who is not a superuser, asks the manager replica that minted the handle for a verdict, cached on the node for 60 seconds. A refused statement never executes.
5. **Execute and stream.** The node runs the SQL against its DuckLake catalog and streams Arrow batches back through the edge to the client.

## Why this shape

- **DuckDB for compute, DuckLake for state.** Each node is a fast embedded engine; the durable catalog and Parquet data live in shared Postgres + object storage, so nodes are interchangeable and a pool can scale horizontally over one consistent view.
- **One endpoint, many nodes.** Clients see a single gateway, whichever wire they speak; it hides node placement, load balancing, transaction pinning, and failover-with-retry.
- **Two wires, one policy.** The FlightSQL edge and the native Quack front door share the same authentication, the same node-side authorization, the same router and the same audit log. The wire a client picks changes the driver, not the governance.
- **Access control on what DuckDB resolved.** Authentication happens once, at the edge; authorization happens in the node, on the bound plan, against grants the manager holds. Nothing a statement hides behind a view, a macro or a `query()` string escapes the check, and the same RBAC model covers native and federated tables alike.

## The pipeline in detail

Every query takes the same path, whichever protocol your tool speaks. A query your access rules do not allow never reaches a node.

```diagram
title: What QoD does with each query, from sign-in to the DuckDB node
nodes:
  q: {label: Your query, kind: client, detail: "over Flight SQL or DuckDB's protocol"}
  signin: {label: Sign-in, kind: person, detail: "password, SSO or token"}
  rules: {label: Your access rules, kind: service, accent: true, detail: [table grants, "row filters, column masks"]}
  route: {label: Routing, kind: balancer, accent: true, detail: [the least busy node, a transaction stays on one node]}
  node: {label: DuckDB node, kind: server, accent: true, detail: [runs the query on your data, streams the results back]}
  refused: {label: Refused and audited, kind: service, dashed: true}
edges:
  - q -> signin
  - signin -> rules
  - "rules -> route: allowed"
  - route -> node
  - "rules -.-> refused: denied"
```

**Where your data lives.** QoD keeps two kinds of state in PostgreSQL, in separate databases that can share one cluster: its own settings (tenants, pools, users and grants), and for each of your databases the DuckLake catalog that lists your tables. The table data itself is Parquet files in your object storage. See [State storage](/qod/concepts/state-storage) and [DuckLake catalogs](/qod/concepts/catalogs).

## Where to go next

- Operators: start with [Deployment](/qod/operating/deploy-local) and [Tenants and databases](/qod/operating/tenants-databases).
- Client developers: [Connecting clients](/qod/connecting/clients).
- Contributors: the [Architecture map](/qod/contributing/architecture-map) and [Extending the manager](/qod/contributing/extending).
