---
id: resilience
title: Resilience and recovery
description: "What happens when a DuckDB node, the manager or Postgres fails: the topology, recovery behaviour, and the known gaps with their issue numbers."
keywords: ["resilience", "high availability", "failover", "recovery"]
---

This page describes what the code does today. Aspirational items are noted as gaps. Where a known gap maps to a tracked issue, the issue number is included.

## Topology

By default quack-on-demand runs as a single-instance manager process, designed to be safely restartable. Multi-manager high availability is opt-in and needs the Kubernetes or the [fleet](/qod/operating/deploy-fleet) runtime: set `QOD_HA_ENABLED=true` (on Kubernetes, Helm `replicaCount > 1`) to run N active-active replicas that all serve REST and FlightSQL. One replica holds a Postgres session advisory lock (`HaCoordinator`) and runs the singleton duties (reconcile respawns, bootstrap, DuckLake init, revoked-jti purge); pool mutations serialize across replicas via per-pool advisory locks (`PoolLocker`); caches propagate over Postgres `LISTEN`/`NOTIFY` on the `qod_topology` / `qod_rbac` / `qod_revocation` channels with a periodic snapshot-refresh fallback, and JWT revocations persist in `qodstate_revoked_jti`. HA with the local backend is refused at config load. With the flag off (the default), running two uncoordinated managers against the same Postgres control-plane database is unsafe: both would reconcile the same node registry and race on database creation.

On the fleet runtime a node lives on a server that joined with `qod fleet join`. A silent server keeps its node for a grace window (`QOD_FLEET_REASSIGN_AFTER_SEC`, default 600 s) and then loses it to a free server; with no free server the node stays assigned and resumes without a restart if its server returns first. See [When a server goes down](/qod/operating/deploy-fleet#when-a-server-goes-down).

Worker pools scale horizontally. A pool can contain any number of Quack nodes; the router distributes statements across all healthy nodes in the pool. Adding nodes increases query throughput without touching the manager.

## Cold start and reconciliation

When the manager process exits and a supervisor restarts it (systemd, Kubernetes, or a manual rerun of `qod start`), the following sequence runs:

1. **State restored from Postgres.** `PoolSupervisor.restore()` reads the normalized `qodstate_tenant`, `qodstate_tenant_db`, `qodstate_pool`, and `qodstate_node` tables (managed by Liquibase) and re-hydrates the registry into in-memory `TrieMap`s. The RBAC graph (`qodstate_role`, `qodstate_role_permission`, `qodstate_group`, `qodstate_user_role`, `qodstate_user_group`, `qodstate_group_role`, `qodstate_pool_permission`) is rebuilt into the per-session `EffectiveSet` on each connection.

2. **Existing Kubernetes pods adopted.** `KubernetesQuackBackend.discoverExisting()` selects pods by the manager's label (`managed-by=quack-on-demand`) and re-binds them to the in-memory registry. A manager restart does not tear down running pods. On the local runtime nodes are child processes: a clean stop takes them down with the manager, and after an unclean exit they keep running. The reconcile pass below then adopts each live node that a node row names, and for a row whose node no longer answers it stops any process an earlier manager left under that row (`LocalQuackBackend.stopStray`) before starting a fresh node. A leftover with no row (a merge or maintenance node) keeps running and holding its port until it is stopped by hand; new nodes skip any port something already listens on.

3. **Reconciliation.** `PoolSupervisor.reconcile()` compares the restored desired state against what the runtime backend reports as alive (PID + socket check for local, pod `Ready` condition for Kubernetes) and respawns any nodes that should be present but are not. The method is idempotent. Drained pools (zero distribution) are left alone. Beyond this boot pass, `reconcile()` then runs on a background fiber every `reconcileIntervalSec` (default 30 s, env `QOD_RECONCILE_INTERVAL_SEC`; set 0 to disable the loop and keep the boot-only behavior), so a node that dies while the manager is up is respawned on the next tick rather than staying dead until the next restart.

4. **Bootstrap re-seed.** `Main.scala` re-runs the bootstrap sequence on every start. Each step is idempotent: the named tenant/tenant-db/pool are skipped when they already exist, the admin user is inserted only when its row is missing (an existing password is never rewritten), and the backfill of each tenant's [built-in roles and groups](/qod/operating/rbac-model#built-in-roles-and-groups) is a no-op on re-entry.

Typical cold-boot time on a development machine: roughly 5 s process start plus 1 s Liquibase schema diff plus 1 s reconcile plus about 3 s per respawned node. A 3-node pool is back in service in approximately 15 s. A first-ever boot adds another 1-2 s per tenant-db for `CREATE DATABASE` and DuckLake metadata table initialization.

## Health checks

`HealthProbe` runs a background fiber that pings each node's `/ping` endpoint on a fixed interval. The default interval is 5 seconds (`healthCheckIntervalSec = 5` in `application.conf`, overridable via `QOD_HEALTH_CHECK_INTERVAL_SEC`). Each tick updates the `NodeLoadTracker`'s `healthy` flag for the node. The router's `pick()` method excludes nodes where `healthy = false`.

When the ping function throws, the probe catches the exception and marks the node unhealthy rather than terminating the loop.

The probe also checks that the node enforces authorization. Its own statement carries a session handle for the manager's system principal, signed with the node's key, and a second, handle-less `SELECT 1` must be refused: a node that runs it does not enforce (a node started by an earlier release, or a `qod-node` of another node protocol) and is marked unhealthy and never routed to. A node whose key derives from another node-key secret (an HA replica with a different `QOD_NODE_KEY_SECRET`) refuses the handles, and the health loop names that cause.

The first successful probe per node also runs `CREATE SCHEMA IF NOT EXISTS <db>.<schema>` so the pool's default schema exists before `FlightSqlRouter.wrapWithDefaultSchema` ever prepends a `USE` statement to client queries. Subsequent probes revert to plain `SELECT 1`.

**Cold-boot quarantine gap.** A newly spawned or restored node starts with `healthy = true` (the default in `NodeLoad.empty`). The node can therefore receive traffic before its first probe confirms it is reachable. The ~5 s window between spawn and the first successful probe is a known gap: a node that is slow to start can receive statements it cannot yet handle and return transient errors. A future improvement would initialize new nodes with `healthy = false` and flip to `true` only after a confirmed probe.

## In-transaction node death

A FlightSQL request cannot leave a transaction open. Each request runs on a node connection of its own, and a request that opens a transaction it does not end, or ends one it did not open, is refused (`FlightSqlRouter.transactionControl`). `BEGIN; ...; COMMIT` sent as one request runs whole on one node. Interactive transactions belong to the native DuckDB front door (see [Sessions and transactions](../concepts/sessions-transactions.md)).

On the front door, a client's `BEGIN` pins its session to one node connection until `COMMIT` or `ROLLBACK`. When that node dies or leaves the pool, or the connection fails:

- The transaction ends as if an administrator had killed it: the connection is dropped, and the failing statement and every later one are answered `transaction aborted: <reason>; ROLLBACK to continue` (for a node that left the pool, the reason is "the transaction's node left the pool").
- The client's `ROLLBACK` is served on a fresh connection, and the session goes on.
- A `COMMIT` sent after the node left is answered "nothing was committed". A `COMMIT` whose connection failed after it went out may have committed, so it is answered "the transaction's outcome is unknown ... check the data before retrying".

There is no transparent replay: quack-on-demand does not buffer or re-execute the transaction, and the client replays it from `BEGIN`. Each occurrence is recorded in `statements_total` with its status label, so it shows on a metrics panel.

**Outside a transaction.** A failed statement is retried once on another node only when it never reached a node (no connection, a refused session handle, a draining node) or when it is a lone read. Any other statement (a write, DDL, several statements in one request, `BEGIN; ...; COMMIT`) may have committed before its answer was lost, so it is never sent twice: it is answered "the statement's outcome is unknown: its node connection failed after it was sent ... check the data before retrying".

## What survives a restart and what does not

**Durable (survives restart):**
- All control-plane state: tenants, tenant-databases, pools, nodes, users, roles, groups, permissions. These live in Postgres `qodstate_*` tables and are restored by `PoolSupervisor.restore()` on every boot.
- Statement history and the audit log, in `qodstate_stmt_history` and `qodstate_audit`, with `QOD_TELEMETRY_STORE=postgres` (the default); see [Statement history and trends](./history-trends.md).
- Admin UI and CLI sessions and personal access tokens. Sessions are JWTs signed with `QOD_SESSION_JWT_SECRET` or, when it is unset, with the secret the first boot stored in `qodstate_boot_secret`, so they stay valid across restarts and on every HA replica.
- Pool node topology. Kubernetes pods are adopted; local processes are respawned to match the stored desired state.

**Lost on every restart:**

| State | Location | Impact |
|---|---|---|
| Recent statements | `StatementHistoryStore`, a 256-entry in-memory ring buffer per manager | The "Recent statements" panels of the Nodes and Profile pages (and `qod profile statements`) start empty. The persisted statement history is kept. |
| Per-node EWMA latency and total served | `NodeLoadTracker` | Routing load data resets to zero. Traffic distributes evenly until the EWMA converges over the next few seconds of live traffic. |
| Per-node latency histogram (p50/p95/p99) | `NodeLoadTracker` latency ring (256-sample window) | UI latency widgets reset to zero. |
| FlightSQL and native front door sessions | `SessionRegistry` | Every client must reconnect. An open front door transaction is rolled back on its node. |
| Cache-aware routing directory | `PlacementDirectory`, `LocalityTracker`, `RoutingRefsCache` (per-manager, in-memory) | Table-to-node placement hints reset to empty; one pass of live traffic rebuilds them. Routing falls back to least-loaded until the directory repopulates. In HA mode each replica keeps its own directory (no cross-replica coordination): divergence is by design, worst case a table warm on two nodes of a pool (benign redundancy over immutable files). |

All of these recover through re-population from live traffic. None cause incorrect behavior; they only create gaps in operator-visible signal during and immediately after a restart.

## Failure and recovery matrix

| Failure | Detection | Manager behavior | Impact | Tracked gap |
|---|---|---|---|---|
| Quack node crash | `HealthProbe` `/ping` tick (5 s default) plus PID check (local only) | Local: respawn via `spawn-quack-node.sh`. Kubernetes: kubelet restart, manager waits for pod `Ready`. | New traffic routes to other healthy nodes. A front door transaction on the dead node ends: `ROLLBACK` to continue. | - |
| Manager crash (OOM, panic) | Process supervisor (systemd, kubelet, manual rerun) | Cold restart: restore from Postgres, reconcile. | All FlightSQL sessions drop. Approximately 15 s to fully reconcile a 3-node pool. | Graceful shutdown ([#2](https://github.com/starlake-ai/quack-on-demand/issues/2)) |
| Postgres brief outage | Hikari throws on connection acquire | First state-changing request gets a 500. No automatic retry wrapper. | Read-only requests served from in-memory state (including cached `EffectiveSet`s on live FlightSQL sessions) continue to work. Writes, new tenant-db creation, and new-session handshakes all fail. | Need retry wrapper (no issue yet) |
| Postgres down for minutes | Same as above | Manager enters degraded state: established FlightSQL sessions keep flowing but `createPool`, `createTenantDb`, and RBAC CRUD all fail. New connections cannot rebuild the `EffectiveSet` and bounce at handshake. | Existing FlightSQL traffic continues. | Same |
| Manager host loss (Kubernetes node evict) | kubelet | New pod scheduled; cold restart sequence runs on a different host. | Same as manager crash. Set `terminationGracePeriodSeconds` to at least 30 s. | - |
| Network partition between manager and a node | `HealthProbe` flips `healthy = false` after one tick | Node excluded from `Router.pick()`. | A front door transaction on that node ends: `ROLLBACK` to continue. Outside a transaction, a statement that never reached the node, or a lone read, is retried once on another node. | - |
| A node cannot reach the replica that minted its session (replica restarted, down, or unreachable from the node) | The node's verdict call times out (`QOD_AUTHZ_DECIDE_TIMEOUT_MS`, default 2000) | The node refuses the statement with `QoD: authorization unavailable, retry`. | A single statement is retryable (FlightSQL `UNAVAILABLE`); a multi-statement submission is not (`INVALID_ARGUMENT`), since the statements before the refused one may have run. Cached verdicts (60 s) keep serving repeated statements. | - |
| Network partition between manager and all nodes | All nodes flip `healthy = false` | Every routing decision returns `Unavailable("no node compatible")`. FlightSQL responses become errors. | Total query outage until partition heals. The manager process itself does not crash. | - |
| FlightSQL edge crash (`FlightProducerImpl` exception) | The wrapping `IO` returns `Left(throwable)` | `Main.scala` logs the error and parks on `IO.never`. The process stays up but FlightSQL is dead. | Admin UI and `/metrics` continue working. FlightSQL is silently down. | Should exit non-zero so the supervisor restarts (no issue yet) |
| Disk full on manager host | Logback `RollingFileAppender` drops writes; the manager may OOM | Manager eventually crashes. | Same as manager crash. | - |
| Disk full on a Quack node (Parquet write fails) | Node returns 5xx from `/quack`; adapter classifies as `transient` | A lone read is retried once on another node; a write is answered with an unknown outcome; a front door transaction ends. | Reads continue. Writes fail until disk is cleared. | - |
| TLS cert expiry | First TLS handshake fails | Manager refuses new FlightSQL connections. | The auto-generated cert in `certs/` has a 10-year validity. Only a concern for production deployments using externally issued certificates. | Rotate via cert-manager in Kubernetes. |
| Two uncoordinated managers against the same Postgres (HA flag off) | Both restore the same state and both try to reconcile | Both attempt to spawn pods with the same node IDs (Kubernetes API returns 409 for the second create; local mode races on port allocation). `DbAdmin.createDatabase` for new tenant-dbs races: one wins, the other sees "database already exists". **Unsafe with `QOD_HA_ENABLED` off.** | Do not run two managers without HA; enable opt-in HA instead. | Resolved by opt-in HA (`QOD_HA_ENABLED=true`, Kubernetes or fleet runtime): a Postgres session advisory lock elects one leader for reconcile / bootstrap / DuckLake init, and per-pool advisory locks serialize pool mutations. |

## Operational guidance

If you are running the default single-manager mode in production (one manager plus Postgres), the guidance below applies. For zero-downtime rolling deploys and replica-crash tolerance, enable opt-in HA on Kubernetes (`QOD_HA_ENABLED=true`, `replicaCount > 1`) or on the fleet runtime (`QOD_HA_ENABLED=true` on every manager); the same process-supervisor and probe guidance then applies to each replica. Exceptions: the release that renames `qodstate_user.role` to `kind` cannot be rolled; stop every replica, then start them all on the new version (see [Upgrading to the built-in RBAC release](/qod/operating/rbac-model#upgrading-to-the-built-in-rbac-release)). Neither can 0.11.0, whose migration `0055` drops a column the previous release reads: scale to one replica or use a `Recreate` rollout, and restart every node afterwards (see [Upgrading to 0.11.0](./upgrading.md)).

- **Run under a process supervisor** that restarts the manager on exit: systemd with `Restart=always` ([recommended unit](deploy-single-server.md#03-run-the-manager-under-systemd)), a Kubernetes `Deployment` with `restartPolicy: Always` (the default), or Docker with `restart: unless-stopped`.

- **Add Kubernetes readiness and liveness probes** before exposing the manager to traffic:

  ```yaml
  readinessProbe:
    httpGet: { path: /health, port: 20900 }
    initialDelaySeconds: 5
    periodSeconds: 5
    failureThreshold: 3
  livenessProbe:
    httpGet: { path: /health, port: 20900 }
    initialDelaySeconds: 30
    periodSeconds: 10
    failureThreshold: 5
  ```

  The `/health` endpoint returns OK after `PoolSupervisor.restore()` and `reconcile()` complete their first pass.

- **Back up Postgres with point-in-time recovery.** Everything that survives a manager restart lives there.

- **Set `terminationGracePeriodSeconds: 60`** so in-flight FlightSQL queries have time to complete before the process is killed (useful even without a graceful shutdown handler).

- **Monitor `statements_total{status!="ok"}` rate.** A spike in `transient`, `no_node`, or `pin_lost` is the leading indicator for node trouble. A spike in `permanent` typically means client-side SQL errors.

- **Set up an external `/health` watcher** independent of the manager process (for example, a Prometheus `probe_success` check). Routine reachability is the first thing to know when investigating an outage.

- **Design FlightSQL clients with retry logic.** ADBC includes it; JDBC pools usually do; raw gRPC code needs explicit handling. A manager restart is the most common interruption clients will encounter.

## Secure in production

- [ ] Under HA (`QOD_HA_ENABLED=true`), give every replica the same `QOD_SESSION_JWT_SECRET` and the same `QOD_NODE_KEY_SECRET` (at least 32 characters), or leave each one unset on all of them so that they share the stored value: nodes refuse the handles of a replica with another node-key secret. Pin both from an external secret store when control-plane backups are less trusted than the manager (see [Sessions](./authentication.md#sessions) and [Node keys and the decide URL](./hardening.md#node-keys-and-the-decide-url)).
- [ ] Let each replica name itself in `QOD_INTERNAL_URL`. The Helm chart sets it from the pod IP and refuses `env.QOD_INTERNAL_URL`; on fleet, set it on each replica to its own address on the servers' private network, never a load balancer or an address several replicas share.
- [ ] Keep the node verdict listener (`QOD_INTERNAL_PORT`, the REST port plus one, `20901` in the chart) reachable from nodes only: the chart's `networkPolicy.enabled=true` on Kubernetes, a firewall on fleet. A client that fills its connections stops authorization for every tenant.
- [ ] Keep manager-to-node traffic on a private network: it is plain HTTP.
- [ ] Protect Postgres backups, snapshots and read replicas like the secrets they hold: without pinned secrets they carry the session secret and the node-key secret, and in every case each database's catalog password, tenants' OIDC client secrets and users' own S3 keys.

See [Security hardening](./hardening.md) for the network policy and the node-key secret in full.
