---
id: architecture
title: "Architecture of a multi-tenant DuckDB gateway"
sidebar_label: "Architecture"
description: "How QoD puts an authenticated, access-controlled, horizontally scaled SQL surface in front of DuckDB: planes, object model, request flow."
keywords: ["duckdb architecture", "duckdb gateway", "control plane", "data plane", "flight sql", "ducklake"]
---

QoD is a gateway that puts a multi-tenant, access-controlled, horizontally-scaled SQL surface in front of DuckDB. Clients reach it over Arrow Flight SQL or DuckDB's native Quack protocol; either way the gateway authenticates them, authorizes each statement, and routes it to one of many DuckDB Quack nodes backed by shared DuckLake catalogs. This page is the conceptual overview; the pages it links to go deeper, and the [Architecture map](/qod/contributing/architecture-map) covers the codebase for contributors.

## The planes

The system separates a control plane from a data plane:

- **Control plane** - the manager process: a REST API and React admin UI for managing tenants, databases, pools, users, and access control, plus the supervisor that spawns and tracks nodes. Its state lives in the control-plane store (see [State storage](/qod/concepts/state-storage)).
- **Data plane** - the FlightSQL edge, the native Quack front door, and the Quack nodes behind them. This is where queries flow. The edge is stateless per request beyond the session it tracks; the nodes hold the DuckDB engines.

Both run in a single uber-jar exposing four sockets: the manager REST + UI (`:20900`), the FlightSQL edge (`:31338`), the native Quack front door (`:9494`, what a DuckDB client `ATTACH`es to), and the range of child Quack nodes.

## The object model

Three nested levels organize everything (see [Tenancy model](/qod/concepts/tenancy)):

- A **tenant** is the isolation boundary and selects its users' auth provider.
- A **tenant-db** is a database: a separate Postgres database holding a DuckLake catalog and a data path (see [DuckLake catalogs](/qod/concepts/catalogs)).
- A **pool** is a set of Quack nodes bound to one tenant-db, and is what clients connect to.

## The request lifecycle

When a client runs a statement, it passes through a fixed sequence:

1. **Authenticate.** The edge validates the connection's credential (database password, JWT, or OIDC) and resolves the target `(tenant, pool)`; the owning tenant-db is resolved server-side. See [Authenticating](/qod/connecting/authenticating).
2. **Authorize.** When ACL is enabled, the statement is parsed and every table access is checked against the principal's effective permissions before it touches a node. See the [Access control model](/qod/operating/rbac-model).
3. **Classify and route.** The statement is classified read / write / DDL and dispatched to the least-loaded node whose role can serve it (on object-store pools, biased toward a node that already has its tables cached); an open transaction pins to its node. See [Routing](/qod/concepts/routing) and [Sessions and transactions](/qod/concepts/sessions-transactions).
4. **Execute and stream.** The chosen DuckDB node runs the SQL against its DuckLake catalog and streams Arrow batches back through the edge to the client.

## Why this shape

- **DuckDB for compute, DuckLake for state.** Each node is a fast embedded engine; the durable catalog and Parquet data live in shared Postgres + object storage, so nodes are interchangeable and a pool can scale horizontally over one consistent view.
- **One endpoint, many nodes.** Clients see a single gateway, whichever wire they speak; it hides node placement, load balancing, transaction pinning, and failover-with-retry.
- **Two wires, one policy.** The FlightSQL edge and the native Quack front door share the same authentication, the same per-statement ACL, the same router and the same audit log. The wire a client picks changes the driver, not the governance.
- **Access control at the gateway.** Authentication and per-statement authorization happen once, at the edge, independent of which node executes, so the same RBAC model covers native and federated tables alike.

## The pipeline in detail

```diagram
title: QoD architecture, from the client ports to the node pools, storage and metrics
zones:
  manager: {label: QoD manager}
  data: {label: Data plane, detail: native only, in: manager}
  control: {label: Control plane, in: manager}
  POOL: {label: Quack node pool, detail: per tenant}
nodes:
  C1: {label: JDBC / ADBC client, kind: client}
  C3: {label: DuckDB, kind: client, detail: quack extension}
  C2: {label: Browser, kind: browser, detail: admin UI}
  EDGE: {label: FlightEdgeServer, kind: server, accent: true, in: data, detail: [":31338 TLS, Arrow FlightSQL"]}
  QUACK: {label: QuackFrontDoorServer, kind: server, accent: true, in: data, detail: [":9494 native Quack protocol", byte relay]}
  AUTH: {label: AuthenticationService, kind: service, in: data, detail: ["Database, JWT, OIDC, ROPC", GoogleGroupsLookup, RoleExtractor]}
  FSR: {label: FlightSqlRouter, kind: service, in: data, detail: [FlightProducerImpl, SessionRegistry]}
  POL: {label: ACL check, kind: service, in: data, detail: [PostgresAclValidator, "acl.parser: SqlParser, TableExtractor"]}
  ROUTE: {label: Router, kind: service, in: data, detail: ["StatementClassifier, RoleMatcher", "NodeLoadTracker: read, write, dual"]}
  WIRE: {label: QuackHttpClient, kind: service, in: data, detail: ["QuackHttpAdapter, QuackProtocol (JNI)", application/vnd.duckdb]}
  REST: {label: ManagerServer REST, kind: server, accent: true, in: control, detail: [":20900, Tapir and http4s Ember", Prometheus /metrics]}
  API: {label: API handlers, kind: service, in: control, detail: ["tenant, pool, node, user, role", "group, catalog, config, session", "history, rbac"]}
  SUP: {label: PoolSupervisor, kind: service, in: control, detail: ["HealthProbe, drain, restart"]}
  BK: {label: QuackBackend, kind: service, in: control, detail: [selected by runtimeType, "Local or Kubernetes"]}
  MET: {label: MetricsRegistry, kind: metrics, in: manager, detail: [StatementInstruments]}
  WO: {label: WRITEONLY, kind: server, accent: true, in: POOL, detail: [":21900, pod"]}
  RO: {label: READONLY, kind: server, accent: true, in: POOL, detail: [":21901, pod"]}
  DU: {label: DUAL, kind: server, accent: true, in: POOL, detail: [":21902, pod"]}
  PG: {label: PostgreSQL, kind: database, detail: ["control plane: qodstate_*", "Liquibase, RBAC", per-tenant DuckLake catalogs]}
  OBJ: {label: Object storage, kind: bucket, detail: ["S3, GCS, local FS"]}
  SINK: {label: Metrics sink, kind: metrics, detail: ["Prometheus, CloudWatch", "Azure, GCP"]}
edges:
  - C1 -> EDGE
  - C3 -> QUACK
  - C2 -> REST
  - EDGE -> AUTH
  - QUACK -> AUTH
  - AUTH -> FSR
  - FSR -> POL
  - POL -> ROUTE
  - ROUTE -> WIRE
  - REST -> API
  - API -> SUP
  - SUP -> BK
  - "WIRE -> POOL: vnd.duckdb wire"
  - "BK -> POOL: spawn, scale, quarantine"
  - "control -.-> PG: control-plane, pool and node state"
  - "POOL -> PG: catalog"
  - "POOL -> OBJ: data read and write"
  - EDGE -.-> MET
  - SUP -.-> MET
  - MET -> SINK
```

**Two paths into Postgres.** The **manager** owns the control plane: it writes `qodstate_tenant` / `qodstate_tenant_db` / `qodstate_pool` / `qodstate_node` on tenant + pool CRUD, and resolves the cached `EffectiveSet` for each authenticated session at handshake. Each **Quack node** owns the data plane against its tenant-db, reading and writing that DB's DuckLake `__ducklake_*` catalog tables directly. Two databases per tenant-db deployment (control-plane `qod` + tenant-db `${tenant}_${tenantDb}`) keep the control plane and DuckLake catalog cleanly separated while sharing one Postgres cluster.

## Where to go next

- Operators: start with [Deployment](/qod/operating/deploy-local) and [Tenants and databases](/qod/operating/tenants-databases).
- Client developers: [Connecting clients](/qod/connecting/clients).
- Contributors: the [Architecture map](/qod/contributing/architecture-map) and [Extending the manager](/qod/contributing/extending).
