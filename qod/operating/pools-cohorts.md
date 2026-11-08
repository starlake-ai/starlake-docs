---
id: pools-cohorts
title: Pools and cohorts
description: "Create, size, scale and stop pools of DuckDB nodes, the node roles that drive routing, and cohort-based node placement on Kubernetes."
keywords: ["duckdb pools", "scaling", "cohorts", "node placement"]
---

A pool is a set of DuckDB Quack nodes bound to one database (tenant-db). It is the object clients connect to, and the unit the gateway routes statements across. This page covers creating, sizing, scaling, and stopping pools, the node role distribution that drives routing, and cohort-based node placement on Kubernetes.

Provision the tenant and database first (see "Tenants and databases"). For how pool access governs database access, see the [Access control model](/qod/operating/rbac-model). The examples below use the [qod CLI](/qod/cli/); they assume `qod login` has stored a session, or `QOD_TOKEN` holds a personal access token for CI scripts.

## Node roles and the role distribution

Every node in a pool has one of three roles. The router picks a node for each statement by the statement's kind:

| Role | Serves | Falls back to |
|---|---|---|
| `readonly` | SELECT and other read-class statements | `dual` |
| `writeonly` | INSERT / UPDATE / DELETE / DDL / transaction control (BEGIN, COMMIT, ROLLBACK) | `dual` |
| `dual` | Both reads and writes | none |

When a pool is created you declare how its nodes split across the three roles via `roleDistribution`. The three counts must sum to `size`. A pool of all-`dual` nodes is the simplest choice; splitting `readonly` from `writeonly` lets read and write traffic scale and fail independently.

Within the acceptable roles for a statement, the router picks the least-loaded node (in-flight count plus an EWMA of completed-statement latency). On object-store pools it biases that choice toward a node that already has the query's tables cached, staying within a load cap; see [cache-aware placement](/qod/concepts/routing).

## Create a pool

```bash
qod pool create --tenant acme --db acme_sales --pool bi --size 3 \
  --writeonly 1 --readonly 1 --dual 1
```

| Field | Default | Meaning |
|---|---|---|
| `tenant` | required | Owning tenant. |
| `tenantDb` | required | The database this pool binds to (the `name` suffix used at database creation, e.g. `sales`). |
| `pool` | required | Pool name, unique within the database. |
| `size` | required | Total node count. Must equal the sum of `roleDistribution`. |
| `roleDistribution` | required | `{writeonly, readonly, dual}` node counts. |
| `idleTimeoutSec` | `-1` | Per-pool idle-timeout setting, persisted on the pool. `-1` means unset. It is recorded on `qodstate_pool` and surfaced back on reads; no automatic idle-shutdown loop acts on it today. |
| `maxConcurrentPerNode` | `0` | Per-node concurrency cap used for capacity-aware routing. `0` means unbounded. |
| `cohorts` | `[]` | Optional Kubernetes placement plan (see below). Empty schedules every node with no constraint. |
| `minNodes` / `maxNodes` | unset | Optional [autoscale band](/qod/operating/autoscaling). Set both or neither; when set, the pool sizes itself within those bounds. Cannot be combined with `cohorts`. |
| `disabled` | `false` | When true the pool is spawned warm but the edge rejects fresh handshakes until it is enabled. |
| `initSql` | empty | SQL the pool's nodes run at start, after the catalog attach. A tenant admin's runs under the [initSql allowlist](./tenants-databases.md#init-sql-trust); change it later with `qod pool set-init-sql` (`POST /api/pool/setInitSql`), effective at the next node spawn. |

The pool inherits its metastore (Postgres connection and data path) from the tenant-db; you do not pass storage config on `pool/create`.

## Inspect, scale, and stop

```bash
# List all pools with their live node tables
qod pool list

# Status of one pool (live per-node metrics: in-flight, served, latency)
qod --json pool list | jq '.pools[] | select(.tenant=="acme" and .pool=="bi")'

# Scale to a new size and role split (--force skips graceful drain when shrinking)
qod pool scale --tenant acme --db acme_sales --pool bi --target-size 6 \
  --writeonly 1 --readonly 3 --dual 2

# Disable a pool without removing it (edge rejects fresh handshakes)
qod pool set-disabled --tenant acme --db acme_sales --pool bi --disabled

# Stop the pool's nodes, keeping the registration (--force skips the graceful drain; omitted here)
qod pool stop --tenant acme --db acme_sales --pool bi
```

A graceful stop (no `--force`) drains in-flight statements before terminating nodes. `--force` terminates immediately. The same `--force` flag applies when `scale` shrinks a pool.

How a graceful drain works (scale-down, stop, delete and suspend):

- The nodes being removed are marked draining. New statements are no longer routed to them. A statement that was about to start on one is refused with a retryable answer and runs once on another node, on FlightSQL and on the native DuckDB front door alike.
- The manager waits for the work already running on those nodes: FlightSQL statements, and native front-door statements until the client has read their result. An open native transaction (`BEGIN` on the front door) keeps its node until `COMMIT` or `ROLLBACK`.
- The wait is bounded by `QOD_POOL_DRAIN_TIMEOUT_SEC` (default 20 s, below the CLI's 30 s request timeout). When it runs out, the nodes are stopped anyway. A front-door transaction still open on a stopped node gets "the transaction's node left the pool; ROLLBACK to continue", and a `COMMIT` there reports that nothing was committed.
- A suspend waits only for statements in flight, not for open transactions: their `COMMIT` would wake the pool, which the suspend is holding.
- While a pool drains, the leader's reconcile, autoscale and hibernation passes skip it and come back on a later tick, so other pools are not held up.
- `QOD_DRAIN_TIMEOUT_SEC` (default 60 s) is a different setting: how long a manager shutting down waits for its in-flight statements.

The drain counts the work of the manager that runs the teardown. Under HA it does not wait for statements another replica is serving on the same node, and REST or MCP previews and data diffs are not counted.

A pool can also size itself: declare a `minNodes`/`maxNodes` band and the manager adds and removes read nodes with demand, within those bounds. See [Autoscaling pools](/qod/operating/autoscaling). A pool with a band refuses a manual `scale` outside it.

## Pending slots (fleet runtime)

On the [fleet runtime](/qod/operating/deploy-fleet) a pool can ask for more nodes than there are free servers. The create or scale succeeds, the nodes that can start do, and the remaining slots stay **pending** until servers join; the manager fills them on its reconcile loop. `qod pool list` reports them per pool:

| Field | Meaning |
|---|---|
| `pending` | Slots the role distribution wants that no node fills yet (`0` on the local and Kubernetes runtimes). |
| `pendingReason` | `none_free` (no reachable, schedulable, idle server) or `none_fits` (idle servers exist, none reports enough RAM for the pool's `memory`). |

Each fleet node also carries `serverName` and `serverState` (`reachable` / `unreachable` / `dead`).

## Node pod sizing (Kubernetes)

On the Kubernetes backend a pool carries optional `cpu` and `memory` quantities. Each is applied as both the request and the limit on the `quack` container of every node pod, so setting both yields Guaranteed QoS. The local backend ignores them. On the [fleet runtime](/qod/operating/deploy-fleet#resource-limits-per-node) the same two values become DuckDB `SET threads` / `SET memory_limit` on each node (engine-enforced; an explicit `SET` in init SQL wins), and `memory` also filters which servers can receive the pool.

```bash
qod pool set-resources --tenant acme --db acme_sales --pool bi --cpu 2 --memory 8Gi
```

- Values take effect on the next node spawn (idle-timeout replacement, scale-up, manual restart). Restart the pool's nodes to apply immediately. An empty string clears a value.
- The API accepts any valid Kubernetes quantity. The admin UI exposes the same setting as sliders on the pool create form and the pool detail page, covering 0.5 to 128 CPU cores and 1 to 1024 Gi of memory; values outside the slider range set through the API are shown as raw text.
- Size the DuckDB engine below the pod: set `SET memory_limit = '...'` (about 80% of pod memory) in the database or pool `initSql` so the engine spills to disk before the kernel OOM-kills the pod.
- The Helm chart's `resources` value sizes the manager container, not node pods; node pods are sized per pool with this endpoint.

When requests-and-limits are not enough (sidecars, volumes, affinity), a pool can carry a full Pod-manifest template via `qod pool set-pod-template` (`POST /api/pool/setPodTemplate`; CLI/API-only, superuser-only, gated behind `QOD_POD_TEMPLATE_ENABLED`, default off). The template must contain a container named `quack`; the manager overlays the pod name, its identity labels, and the quack container's env contract and resources.

## Temp directory and spilling

When a statement needs more memory than the node's `memory_limit` allows (large sorts, joins, aggregations), DuckDB writes the overflow to files in its temp directory and removes them when it is done. Plan disk for this as you plan memory: it decides how large a query can get before it fails.

QoD sets the temp directory itself when a node starts, and gives each node a folder of its own (`qod-node.*`), so that no node reads another's spill files. No environment variable, configuration key or Helm value changes it.

| Deployment | Where a node spills by default |
|---|---|
| Kubernetes | `/duckdb-tmp/qod-node.*`, on the `emptyDir` every node pod carries. It has no size limit of its own, draws on the Kubernetes node's disk, and is gone with the pod |
| Single Docker container | `/app/.tmp/qod-node.*`, in the container's writable layer: the compose file mounts nothing there |
| Local, single server, fleet | `.tmp/qod-node.*` under the directory the node is started from, on each server |

If that folder cannot be created, the node uses a `tmp` folder in its private directory under `TMPDIR`. QoD removes the folder when the node stops, and a later node start sweeps those a killed node left behind.

**To spill on another disk**, put that disk behind the default path, which keeps the per-node folders and their cleanup:

- **Kubernetes:** in a [pod template](#node-pod-sizing-kubernetes), declare a volume named `duckdb-tmp` and mount it at `/duckdb-tmp`; the manager then adds neither. It must be writable by the node's user (uid 1000 by default).
- **Single Docker container:** add a bind mount to the `quack` service's `volumes` (`- /fastdisk/qod-tmp:/app/.tmp`), on a host folder the container's user can write to.
- **Local, single server, fleet:** make `.tmp` a mount or a symbolic link to the fast disk.

**Or set the path in SQL**, with `SET temp_directory = '/fastdisk/duckdb-tmp'` in a database's or pool's `initSql`, written by a superuser (a tenant admin's is refused). It overrides QoD's value, and a pool's wins over its database's. Every node of that database or pool then uses the same folder, so nodes on one host lose the per-node separation, and QoD does not clean that folder. Keep it on local disk, never on the object store.

**To cap it**, use `SET max_temp_directory_size = '200GB'` in `initSql`, which a tenant admin may also write. It applies per node, and DuckDB's default is 90% of the disk's free space. A statement that would pass the cap fails, instead of filling the disk.

Either setting takes effect when a node starts. Tenant users cannot change the path from a session, and with [local files off](./hardening.md#local-files-off) nobody can, superusers included; spills keep working. Watch `node_duckdb_spill_bytes` and `node_duckdb_spill_files` ([metrics](../reference/metrics.md)): sustained spilling means `memory_limit` is too small for the workload.

## Cohorts and Kubernetes placement

By default the supervisor schedules every node in a pool with no placement constraint. On the Kubernetes backend you can instead split a pool into cohorts, each pinned to a class of nodes with a `nodeSelector` and tolerations. This is how you keep, for example, the write nodes on memory-optimized hardware and the read nodes on cheaper general-purpose nodes.

A cohort carries a `placement` (Kubernetes `nodeSelector` plus `tolerations`) and its own `distribution`. `qod pool create` does not yet expose a `--cohorts` flag, so set cohorts through the manifest: `qod manifest export --out manifest.yaml`, add or edit the `cohorts` list under the target pool, then `qod manifest import manifest.yaml`. Because nested collections (a tenant's `pools`, in this case) are replaced wholesale on import, always edit a full export - re-importing a hand-written fragment with only one pool would delete the tenant's other pools. See [Manage by manifest](/qod/administration/manage-by-manifest).

```yaml
tenants:
  - name: acme
    pools:
      - name: bi
        tenantDb: sales
        roleDistribution: { writeonly: 1, readonly: 2, dual: 1 }
        cohorts:
          - placement:
              nodeSelector: { workload: write }
              tolerations:
                - { key: dedicated, operator: Equal, value: write, effect: NoSchedule }
            distribution: { writeonly: 1, readonly: 0, dual: 1 }
          - placement:
              nodeSelector: { workload: read }
            distribution: { writeonly: 0, readonly: 2, dual: 0 }
```

Two validation rules apply when `cohorts` is non-empty:

1. The per-cohort `distribution` values must sum, role by role, to the pool's top-level `roleDistribution`.
2. The total node count across all cohorts must equal `size`.

Each toleration is `{key, operator, value, effect}`, matching the Kubernetes pod toleration fields.

Cohorts are ignored on the local (non-Kubernetes) backend, where all nodes are child processes of the manager and there is nothing to place them on. The admin UI hides the per-pool placement controls unless the runtime backend reports that placement is supported. For the Kubernetes backend itself, see [Kubernetes deployment](/qod/operating/deploy-kubernetes).

## Secure in production

- [ ] Review the pool `initSql` that tenant admins write. It runs under the [initSql allowlist](./tenants-databases.md#init-sql-trust), but on Kubernetes, and on fleet without `QOD_FLEET_EPHEMERAL=local`, the manager cannot check it when it is saved: the write is accepted with an `initSqlWarning`, and the node skips each refused statement.
- [ ] On Kubernetes, size every pool's nodes with `qod pool set-resources --cpu <n> --memory <q>` and cap the engine below the pod with `SET memory_limit` in `initSql`, so that one tenant's queries cannot take a whole host from its neighbours.
- [ ] Grant tenant-admin rights only to people who may spend node capacity. The manager enforces no per-tenant node quota of its own (only a manager module can add one), so a tenant admin can create pools, scale them and set their `cpu` and `memory`.
- [ ] On Kubernetes, give the pools of tenants you do not fully trust nodes of their own with `cohorts` (a `nodeSelector` plus tolerations); without them, node pods of every tenant share the cluster's nodes.
- [ ] Leave `QOD_POD_TEMPLATE_ENABLED` at `false` unless a pool needs a full pod template. Setting a template is superuser-only, and a template adds its volumes and sidecars to every node pod of the pool.

See [Security hardening](./hardening.md) for the node pods' security context, the network policy around them, and the rules that tenant admins' init SQL runs under.
