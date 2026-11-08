---
id: architecture-map
title: Architecture map
description: "Codebase orientation for contributors to Quack on Demand: process model, request flow, and where each concern lives in the source tree."
keywords: ["contributing", "architecture map", "codebase"]
---

This page orients a contributor in the codebase: the process model, the request flow, and where each concern lives. For the runtime concepts behind it, see [Architecture](/qod/concepts/architecture) and the rest of the Concepts section.

## One process, four sockets

The manager is a single uber-jar that exposes four sockets:

| Socket | Default | What it is |
|---|---|---|
| Manager REST + React UI | `:20900` | Tapir + HTTP4s Ember. Endpoints under `ondemand/api/*Handlers.scala`; the SPA at `/ui/*` is served from `src/main/resources/ui`. |
| Arrow FlightSQL edge | `:31338` | The query surface for driver-based clients. TLS on by default, cert auto-generated under `certs/`. |
| Native Quack front door | `:9494` | The query surface for DuckDB clients (`ATTACH 'quack:host:9494'`). `edge/quack/QuackFrontDoorServer.scala`; relays each statement to a node byte for byte. Plain HTTP by default, see [TLS](/qod/operating/tls). |
| Quack nodes | `:21900-22500` | `qod-node` processes (local mode), pods (Kubernetes) or fleet server processes, each serving a `/quack` HTTP endpoint. `qod-node` (`native/qod-node`) is QoD's own executable on the official DuckDB release library; it authorizes every statement before it runs. |

## The FlightSQL request flow

A query traverses these components in order:

```
client
  → FlightProducerImpl        (Arrow Flight wire surface)
  → AuthenticationService     (Basic / JWT / OIDC)
  → FlightSqlRouter.execute   (the routing core; policy holders' guard,
                                CLS / RLS rewriters, metadata filter)
  → StatementClassifier       (READ / WRITE / DDL bucket)
  → Router.pick               (least-loaded node for the kind)
  → QuackHttpAdapter          (session handle, then the statement, to the node's /quack)
  → qod-node                  (parse screen, plan description, verdict
                                from the minting replica's DecideRoute / AuthzDecider)
  → Arrow stream back through Flight
```

The node's verdict is the only table, function, setting and file check: the gateway has none of its own since 0.11.0 (the former `StatementValidator`, `PostgresAclValidator` and `OpaValidator` were removed). Grants are matched by `AuthzDecider` (`edge/authz/`) through `GrantMatch` (`edge/sql/`).

The routing core (`FlightSqlRouter`, `Router`, `StatementClassifier`, `RoleMatcher`) is deliberately separable from the Flight wire, so `RouterSpec`, `StatementClassifierSpec`, and `FlightSqlRouterSpec` exercise it without a live Flight connection.

## Package layout

| Package | Responsibility |
|---|---|
| `ai.starlake.quack` (`Main.scala`, `boot/`) | Wiring: load config, pick the state store, build the auth service and the node decision pipeline, select the runtime backend, mount endpoints. |
| `ai.starlake.quack.edge` | The FlightSQL edge: `FlightEdgeServer`, `FlightProducerImpl`, `FlightSqlRouter`, sessions, the Quack HTTP adapter. |
| `ai.starlake.quack.edge.authz` | In-engine authorization on the manager side: session handles and node keys, the `/api/internal/authz/decide` and `/credentials` routes, `AuthzDecider`, function and setting classification. |
| `ai.starlake.quack.edge.auth` | Authentication providers (database, JWT, OIDC, OAuth), `AuthScope` realm tagging, `TenantOidcRegistry` for per-tenant OAuth client overrides, role extraction. |
| `ai.starlake.quack.secrets` | `SecretRefResolver` -- shared `env:` / `aws-sm:` / etc. reference resolution used by per-tenant OIDC `clientSecretRef` (and reusable elsewhere). |
| `ai.starlake.quack.edge.config` / `edge.catalog` | Auth/session config types and the DuckLake catalog resolver. |
| `ai.starlake.quack.route` | The routing core: `Router`, `RoleMatcher`, `StatementClassifier`. |
| `ai.starlake.quack.ondemand` | The control plane: `ManagerServer`, `PoolSupervisor`, the REST handlers, state stores, RBAC, manifest, runtime backends. |
| `ai.starlake.quack.ondemand.runtime` | The `QuackBackend` strategy and its local / Kubernetes / fleet implementations. |
| `ai.starlake.acl` | The SQL parser the column and row policy rewriters and their guard use. |
| `ai.starlake.quack.observability` | Micrometer metrics and the sink selection. |

## State and storage

`Main.scala` wires the Postgres-only control-plane store: the normalized `qodstate_*` tables managed by Liquibase (the legacy single-blob `file` store and its `stateStorage` / `statePath` config keys were dropped 2026-06-12). See [State storage](/qod/concepts/state-storage). Each managed tenant-db is a separate Postgres database holding its DuckLake catalog; see [DuckLake catalogs](/qod/concepts/catalogs).

## Extending

The two seams a contributor is most likely to extend, the runtime backend and the auth providers, have their own guide: [Extending the manager](/qod/contributing/extending).
