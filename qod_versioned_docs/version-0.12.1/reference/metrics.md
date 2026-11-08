---
id: metrics
title: Metrics
description: "Every metric series emitted by the DuckDB gateway, with its labels, for the Prometheus endpoint and the AWS, Azure and GCP sinks."
keywords: ["metrics reference", "prometheus", "series"]
---

The manager registers these series through Micrometer. They are emitted to whichever sink is active (`QOD_METRICS_SINK`); under the default Prometheus sink they appear at `GET :20900/metrics`. For how to scrape, push to a cloud monitor, or import the Grafana dashboard, see [Observability](/qod/operating/observability).

## Application metrics

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `statements_total` | counter | `tenant`, `pool`, `status` | Statements executed, partitioned by outcome status. Drives QPS and error-rate panels. |
| `statement_duration_seconds` | histogram | `tenant`, `pool` | Statement execution latency; the source of the p50/p95/p99 percentiles. |
| `flightsql_sessions_active` | gauge | (none) | Currently open FlightSQL sessions. |
| `pool_nodes` | gauge | `tenant`, `pool`, `role` | Node count per pool, broken down by node role. |
| `node_healthy` | gauge | `tenant`, `pool`, `node_id`, `role` | 1 when the node is healthy, 0 otherwise. |
| `node_draining` | gauge | `tenant`, `pool`, `node_id`, `role` | 1 when the node is draining in-flight work before shutdown. |
| `node_in_flight` | gauge | `tenant`, `pool`, `node_id`, `role` | Statements currently executing on the node. |
| `node_ewma_latency_seconds` | gauge | `tenant`, `pool`, `node_id`, `role` | EWMA of completed-statement latency, the signal the router uses to pick the least-loaded node. |

## Routing metrics

Emitted per routed statement by the [cache-aware placement](/qod/concepts/routing) layer. The locality series (`routing_tables_total`, `routing_placements_total`) run on any routing policy and stay populated even with `QOD_ROUTING_CACHE_AWARE=false`; the decision and load series describe placement outcomes.

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `routing_tables_total` | counter | `tenant`, `pool`, `result` | Table references seen, split into `new` (first time this table is routed) and `repeat` (seen before). A low repeat rate means locality has little to exploit. |
| `routing_placements_total` | counter | `tenant`, `pool`, `result` | Repeat-table routings by whether the table `stay`ed on its last node or `switch`ed to another. The switch rate is the locality-loss (scatter) signal: high means placement is being destroyed. |
| `routing_decisions_total` | counter | `tenant`, `pool`, `outcome` | Placement decisions by outcome: `claim`, `sticky-fresh`, `sticky-stale`, `overflow-new-home`, `overflow-evict-home`, `pinned-sticky`, `pinned-move`, `no-refs-fallback`, `not-eligible`, `flag-off`. Frequent `overflow-evict-home` on a pool means three homes are not enough for its hottest tables. `pinned-sticky` / `pinned-move` mark statements a transaction pin or soft preferredNode placed rather than the scorer, so they are excluded from the overflow signal. |
| `routing_load_ratio` | summary | `tenant`, `pool` | Chosen-node in-flight count over the pool average. Should stay under `routing.loadCapFactor`; a sustained excess means the load cap is not binding. |

## Maintenance metrics

Emitted per finished [managed-maintenance](/qod/operating/maintenance) run. These series carry the `qod_` prefix; the legacy series above predate the prefix convention.

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `qod_maint_runs_total` | counter | `tenant`, `tenant_db`, `result` | Maintenance runs by outcome (`succeeded`, `failed`, `partial`). A rising `partial` count usually means the pinned-file guard is firing. |
| `qod_maint_bytes_reclaimed_total` | counter | `tenant`, `tenant_db` | Catalog bytes released by runs (physical deletion lags by the cleanup grace window). |
| `qod_maint_files_compacted_total` | counter | `tenant`, `tenant_db` | Files touched by the merge and rewrite steps. |
| `qod_maint_snapshots_expired_total` | counter | `tenant`, `tenant_db` | Snapshots expired (pinned snapshots are skipped, never counted here). |
| `qod_maint_duration_seconds` | timer | `tenant`, `tenant_db` | End-to-end run duration, including maintenance-node spawn time. |

## Authorization metrics

Every tenant statement is authorized on its node: the node asks the manager replica that minted its session handle for a verdict, caches it, and refuses what no grant (or the tenant's OPA policy) covers. See [Access control model](../operating/rbac-model.md). Dry runs (`qod tenant opa-test --sql`) are not counted.

Decisions taken by this replica's decide endpoint (`POST /api/internal/authz/decide`):

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `qod_authz_decisions_total` | counter | `tenant`, `kind`, `outcome`, `mode` | Decisions answered to nodes. `kind` is `plan` (a statement judged on the plan DuckDB bound) or `screen` (the check quack's authorization callback asks for); `outcome` is `allow`, `refuse` or `unavailable`; `mode` is `qod` (grants) or `opa` (the tenant's OPA). A rising `unavailable` rate means decisions could not be had in time, which users see as `QoD: authorization unavailable, retry`. |
| `qod_authz_decide_duration_ms` | summary | `kind` | Time to take one decision, in milliseconds, with fixed buckets from 0.5 to 5000. Prometheus exports `_bucket`, `_count`, `_sum` and `_max`. A grant decision takes well under a millisecond; an OPA tenant's runs up to its OPA timeout. |

Per-node counters, read from each node's `system.main.qod_authz_stats()` by the health probe and exported on Prometheus scrapes by the HA leader only (a single manager always leads), so `sum by (node)` is not multiplied by the replica count. A node that leaves the pool loses its series.

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `qod_node_authz_plan_cache_hits_total` | counter | `tenant`, `pool`, `node` | Plan verdicts served from the node's verdict cache. |
| `qod_node_authz_plan_cache_misses_total` | counter | `tenant`, `pool`, `node` | Plan verdicts not in the cache, each followed by a decide call. |
| `qod_node_authz_decide_calls_total` | counter | `tenant`, `pool`, `node` | Calls the node made to the manager for a verdict. |
| `qod_node_authz_decide_unavailable_total` | counter | `tenant`, `pool`, `node` | Calls that got no verdict in time (replica down, restarted or unreachable from the node). |
| `qod_node_authz_decide_refused_total` | counter | `tenant`, `pool`, `node` | Calls answered with a refusal. |
| `qod_node_authz_local_refusals_total` | counter | `tenant`, `pool`, `node` | Statements the node refused on its own while planning them, without a verdict from the manager (for example a statement shape it cannot describe). |
| `qod_node_authz_screen_calls_total` | counter | `tenant`, `pool`, `node` | Screen checks the node ran for quack's authorization callback. |
| `qod_node_authz_verdict_cache_evictions_total` | counter | `tenant`, `pool`, `node` | Verdicts evicted from a full cache. Sustained growth means `QOD_AUTHZ_CACHE_ENTRIES` is too small for the working set. |
| `qod_node_authz_verdict_cache_size` | gauge | `tenant`, `pool`, `node` | Verdicts currently cached on the node. |
| `qod_node_authz_credential_sets_size` | gauge | `tenant`, `pool`, `node` | Users' own S3 credential sets currently held by the node. |

## Cache metrics

Each replica registers its own bounded caches through Micrometer's Caffeine binder, so a sum across replicas is the fleet's total. The `cache` label is one of `qod_minted_handles` (session handle contexts this replica minted), `qod_issued_handles` (handles whose users' S3 keys a node may fetch), `qod_dry_run_results` (OPA dry-run inputs), `qod_effective_sets` (resolved grants per principal) and `qod_opa_decisions` (registered only while `QOD_OPA_CACHE_TTL_SEC` is above zero).

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `cache_size` | gauge | `cache` | Entries currently held. |
| `cache_gets_total` | counter | `cache`, `result` | Lookups, `result` = `hit` or `miss`. |
| `cache_evictions_total` | counter | `cache` | Entries evicted to stay under the bound. A rising `cache_evictions_total{cache="qod_minted_handles"}` means the replica mints more handles than `QOD_AUTHZ_HANDLE_CONTEXTS_MAX` keeps: raise it. |
| `qod_cache_capacity` | gauge | `cache` | The configured bound, to chart how full each cache is. |

Micrometer's binder also exports its other standard `cache_*` series (puts, eviction weight) under the same `cache` label.

## DuckDB engine metrics

Scraped from each node's DuckDB engine (`duckdb_memory()`, `duckdb_temporary_files()`) by the background health probe, one extra round-trip per node per `QOD_HEALTH_CHECK_INTERVAL_SEC` tick. A node that has never been scraped successfully publishes no row (rather than a misleading zero); a failed scrape keeps the previous sample until the next tick.

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `node_duckdb_memory_used_bytes` | gauge | `tenant`, `pool`, `node_id`, `role` | Buffer-manager memory in use, summed across all consumers (base tables, hash tables, parquet readers, ...). Compare against the node's `memory_limit` to spot memory pressure before latency degrades. |
| `node_duckdb_temp_storage_bytes` | gauge | `tenant`, `pool`, `node_id`, `role` | Bytes the buffer manager has moved to temporary storage. |
| `node_duckdb_spill_files` | gauge | `tenant`, `pool`, `node_id`, `role` | Live spill-to-disk files. Non-zero means queries are exceeding the memory budget and spilling. |
| `node_duckdb_spill_bytes` | gauge | `tenant`, `pool`, `node_id`, `role` | Total size of live spill files. |

## JVM and process metrics

Registered by the Micrometer JVM and process binders:

| Metric | Type | Meaning |
|---|---|---|
| `jvm_memory_used_bytes` | gauge | Heap and non-heap memory in use. |
| `jvm_gc_pause_seconds_sum` | counter | Cumulative GC pause time. |
| `jvm_threads_live_threads` | gauge | Live thread count. |
| `process_uptime_seconds` | gauge | Process uptime since manager start. |

## Common labels

Every series can carry static deployment labels when these are set, useful for separating environments in a shared Grafana:

| Variable | Label | Example |
|---|---|---|
| `QOD_METRICS_DEPLOYMENT` | `deployment` | `prod-eu` |
| `QOD_METRICS_REGION` | `region` | `eu-west-1` |
