---
id: architecture
title: "Architecture of a multi-tenant DuckDB gateway"
sidebar_label: "Architecture"
description: "How QoD works: one secure endpoint in front of DuckDB, made of the manager, DuckDB nodes and your storage, with tenants, databases and pools, and the path every query takes."
keywords: ["duckdb architecture", "duckdb gateway", "duckdb server", "flight sql", "ducklake", "multi-tenant duckdb"]
---

QoD puts DuckDB behind one secure endpoint that a whole team can share. Your BI tools, notebooks and applications connect to QoD as they would to a database server. QoD signs each user in, applies the access rules you set, and runs the query on one of several DuckDB nodes, all reading the same tables. This page explains how the parts fit together. If you work on QoD's code, the [Architecture map](/qod/contributing/architecture-map) has the component-level view.

## How it fits together

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

QoD has three parts:

- **The QoD manager** is the one address your tools connect to. It signs users in, checks every query against your access rules, and sends it to a node. It also serves the admin UI and the REST API you use to create tenants, databases, pools and users.
- **DuckDB nodes** run the queries. A pool holds one or more nodes, and you add nodes when you need more capacity. Every node of a pool reads the same tables, so any node can answer any query.
- **Storage that you provide:** a PostgreSQL database for QoD's settings and the catalog of your tables, and an object store (S3, GCS, Azure Blob Storage, or a local disk) for the data itself, as Parquet files.

The manager listens on three ports that your tools reach:

| Port | What connects to it |
|---|---|
| 31338 | SQL tools over Arrow Flight SQL with TLS: JDBC, ADBC, BI tools, Python |
| 9494 | DuckDB clients that `ATTACH` a QoD database over DuckDB's own protocol |
| 20900 | The admin UI and the REST API |

Your tools never connect to the nodes. On a single server the nodes are processes next to the manager, on Kubernetes they are pods, and in a [fleet](/qod/operating/deploy-fleet) each server runs one node; there, the nodes also call the manager on port 20901, so keep that port open between your servers.

## Tenants, databases and pools

QoD organizes what you host in three levels (see [Tenancy model](/qod/concepts/tenancy)):

- A **tenant** is an organization or a team, isolated from the others. It has its own users and its own way of signing them in: passwords, or your identity provider.
- A **database** belongs to a tenant and holds your tables: a DuckLake catalog in PostgreSQL, and data files in object storage (see [DuckLake catalogs](/qod/concepts/catalogs)).
- A **pool** is a group of DuckDB nodes serving one database. Your tools connect to a pool, and you size each pool for its workload, for example one pool for dashboards and another for batch jobs.

## What happens to a query

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

1. **Sign-in.** QoD checks the user's credential: a password, a token, or a sign-in through your identity provider (OIDC). See [Authenticating](/qod/connecting/authenticating).
2. **Access rules.** QoD applies what you granted: the tables the user may read or change, the rows they see, and the columns that are masked. A query that reaches beyond the user's rights is refused and recorded in the audit log. See the [Access control model](/qod/operating/rbac-model).
3. **Routing.** QoD sends the query to the least busy node of the pool that can run it, preferring a node that already has the tables in its cache. All the statements of a transaction go to the same node. See [Routing](/qod/concepts/routing) and [Sessions and transactions](/qod/concepts/sessions-transactions).
4. **Execution.** The node runs the query on your data and streams the results back to your tool.

The rules are checked against what the query actually reads, once DuckDB has resolved its views, macros and functions. A view or a `query()` call cannot reach a table the user is not allowed to see.

**Where your data lives.** QoD keeps two kinds of state in PostgreSQL, in separate databases that can share one cluster: its own settings (tenants, pools, users and grants), and for each of your databases the DuckLake catalog that lists your tables. The table data itself is Parquet files in your object storage. See [State storage](/qod/concepts/state-storage) and [DuckLake catalogs](/qod/concepts/catalogs).

## Why it is built this way

- **Fast queries on shared tables.** Each node is a full DuckDB engine. Your tables live in shared storage, not inside a node, so every node sees the same data and you scale a pool by adding nodes.
- **One address for your tools.** Your tools only know QoD. It spreads the queries over the nodes, keeps each transaction on one node, and retries a query on another node when one fails, so nodes can come and go without any change on the client side.
- **The same rules however you connect.** Flight SQL and DuckDB's own protocol go through the same sign-in, the same access rules and the same audit log. The protocol a tool uses changes its driver, not what its user can see.
- **One set of rules for all your tables.** The same grants cover the tables QoD hosts and the external tables you attach through [federation](/qod/operating/federation).

## Where to go next

- Try QoD: [Local deployment](/qod/operating/deploy-local), then [Single-server deployment](/qod/operating/deploy-single-server) to run it in production on one machine.
- Set up your tenants and databases: [Tenants and databases](/qod/operating/tenants-databases).
- Connect your tools: [Connecting clients](/qod/connecting/clients).
- Work on QoD's code: the [Architecture map](/qod/contributing/architecture-map) and [Extending the manager](/qod/contributing/extending).
