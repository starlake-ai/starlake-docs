---
id: deploy-local
title: Local deployment
description: "The default local runtime: DuckDB nodes as child processes of the manager on one machine, for development, evaluation and small deployments."
keywords: ["local deployment", "development", "runtime"]
---

## When to use

`runtimeType=local` is the default backend. It is the right choice for:

- Developer workstations and single-host setups where all DuckDB Quack nodes run as child processes of the manager.
- Smoke-testing and integration work where Kubernetes is not available or not needed.
- Small deployments where the total node count fits comfortably on one machine.

For multi-host deployments, see the [fleet runtime](deploy-fleet.md) (your own servers, no Kubernetes) or the [Kubernetes backend](deploy-kubernetes.md). For an end-to-end production walkthrough on one machine (environment, sizing, provisioning, RBAC, monitoring, with runnable scripts), see [Single-server production deployment](deploy-single-server.md).

## Embedded control plane (zero-prerequisite single-node mode)

Since 0.8.6 the local backend can run its control plane on a **bundled, persistent embedded Postgres** instead of an external server: set `QOD_PG_EMBEDDED=true` (or just use `qod serve`, which does it for you). The manager starts the embedded server on a fixed port (`QOD_PG_EMBEDDED_PORT`, default `25432`), rooted at `QOD_PG_EMBEDDED_DATA_DIR` (default `<user-data-dir>/pg`, e.g. `~/Library/Application Support/qod/pg` on macOS), creates the control-plane database if missing, and re-anchors both the metastore coordinates and the database-auth block to it. The data directory is reused across restarts and never deleted; a live `postmaster.pid` from another manager refuses the boot, while a stale one falls through to ordinary Postgres crash recovery. `qod status` reports it by probing the data directory directly, so it answers even when the manager is down.

This is the single-node / evaluation / small-team shape. For production, point the manager at your own Postgres (the rest of this page); HA refuses to boot with the embedded control plane, since one embedded server cannot back multiple replicas.

## How nodes are spawned

`LocalQuackBackend` spawns each Quack node by forking a child process via `scripts/spawn-quack-node.sh`, which runs `qod-node`: QoD's own executable on the official DuckDB release library, not the DuckDB CLI. The jar bundles `qod-node` for Linux and macOS (x86_64, aarch64) and installs it beside the `libduckdb` it loaded; `QOD_NODE_BIN` points the manager at another build, and on Windows `qod start` / `qod serve` download `qod-node-windows-<arch>.exe` and set it. The manager refuses to boot without a `qod-node`, or on one whose `--build-info` names another node protocol or DuckDB release. The manager controls the full lifecycle: it allocates a port from the configured range, generates a random authentication token and the node's authorization key, sets the metastore environment variables, and hands those to the script. When the manager stops (SIGTERM or `qod stop`), it sends SIGTERM to every tracked child and waits up to 5 seconds per process before issuing SIGKILL.

**Port allocation.** The manager maintains a `PortAllocator` bounded by `minPort` and `maxPort` (defaults: 21900 to 22500). Ports are leased on spawn and released on stop. At most `maxNodesTotal` (default: 50) child nodes may be alive at the same time across all pools.

**Do not run `scripts/spawn-quack-node.sh` directly.** The supervisor owns port allocation, token generation, and the metastore environment contract. Manual invocations bypass all of that, leak ports into the allocator's range, and produce orphan processes that cause silent "Authentication failed" errors at query time.

**Orphan cleanup.** A stale listener squatting the node port range makes the next spawn on that port fail. `qod stop` stops the manager's spawn scripts and their `qod-node` children; to clear one manager's orphans by hand from a checkout:

```bash
./scripts/kill-quack-nodes.sh --port 20900   # the nodes of the manager on that REST port
```

The spawn script path can be overridden via `QOD_SPAWN_SCRIPT` when the script is installed outside the repository (for example under `/opt/...` in a container image).

## Node environment contract

`LocalQuackBackend.start()` populates each child process's environment from two sources in order: the `defaultMetastore` block in `application.conf` (or its `QOD_PG_*` env-var overrides), then any per-pool `metastore` entries supplied in the `CreatePoolRequest`. Pool-level keys override the defaults.

The spawn script reads the following variables:

| Variable | Meaning |
|---|---|
| `pgHost` | Hostname of the Postgres server used by DuckLake as its catalog store. |
| `pgPort` | Port of the Postgres server (default `5432`). |
| `pgUser` | Postgres login user (default `postgres`). |
| `dbName` | Postgres database that holds the DuckLake catalog metadata. Also used as the DuckDB catalog name. |
| `schemaName` | DuckLake schema inside `dbName` where tables are registered. Must differ from `dbName` to avoid ambiguous two-part identifiers in DuckDB. |
| `dataPath` | Local or object-store path where DuckLake writes Parquet data files. Accepts `s3://`, `az://`, and `abfss://` URIs for remote storage. Required for `ducklake` and `duckdb-file` nodes: the script refuses to start one without it (`fatal: kind=<kind> needs a dataPath, ...`). |

The script receives the TCP port the node must listen on as its first argument, and the manager's marker (`<rest-port>-<boot id>`, so stopping one manager never touches another's nodes) as its second. Secrets never travel in the environment or on the command line, where a node user with SQL could read them back: `pgPassword`, the database's encryption key, the federation and object-store SQL, the tenant's init SQL, the 256-bit bearer token the manager presents to the node, and the node's authorization key `QOD_NODE_AUTHZ_KEY` arrive as one file per key in a private directory named by `QOD_SECRETS_DIR` (mode 0700, files 0600), which is deleted right after the node reads it (the node id, `QOD_NODE_ID`, is not a secret and stays in the environment). The node key is derived from the node-key secret (`QOD_NODE_KEY_SECRET`, or the value the first boot stored in the control plane).

The `kind` variable is also required. It selects the catalog mode: `ducklake` (DuckLake catalog backed by Postgres), `duckdb-file` (standalone `.duckdb` file), or `memory` (no persistent catalog; useful for federation-only pools).

## Operate locally

**Configuration knobs.** All relevant settings accept `QOD_*` environment variable overrides. See [/reference/configuration](/qod/reference/configuration) for the full list. The most commonly adjusted ones for a local deployment are:

| Env var | Default | Purpose |
|---|---|---|
| `QOD_RUNTIME_TYPE` | `local` | Backend type. Leave as `local` for single-host deployments. |
| `QOD_MIN_PORT` | `21900` | Lower bound of the child node port range. |
| `QOD_MAX_PORT` | `22500` | Upper bound of the child node port range. |
| `QOD_MAX_NODES_TOTAL` | `50` | Hard cap on simultaneous child node processes. |
| `QOD_SPAWN_SCRIPT` | `./scripts/spawn-quack-node.sh` | Path to the node spawn script. |
| `QOD_NODE_BIN` | the bundled `qod-node` | The `qod-node` executable nodes run. |
| `QOD_TENANT_FILES_ROOT` | unset | Folder under which tenants may authorize local file folders for their users (`<root>/<tenant id>/...`). Unset, no local folder can be authorized. |
| `QOD_PG_HOST` | `localhost` | Postgres host for the control plane and default metastore. |
| `QOD_PG_PASSWORD` | `azizam` | Postgres password. Rotate before any non-local exposure. |
| `QOD_DUCKLAKE_DATA_PATH` | `./ducklake/tpch` | Default data path propagated to spawned nodes. |

**Wiping local state.** To discard all state and start fresh, pass `NUKE=1` to `qod start`:

```bash
NUKE=1 qod start
```

This stops any running manager, drops the Postgres control-plane database and the bootstrap tenant database, and removes the `ducklake/`, `state/`, and `certs/` directories. This action is irreversible.

To boot freshly seeded instead of empty, combine `NUKE=1` with the demo seed flags. `DEMO=minimal` selects the single-DuckDB profile - one tenant (`acme`), one pool (`bi`), one dual node serving both reads and writes - the shape for fronting a single DuckDB/DuckLake database:

```bash
NUKE=1 DEMO=minimal LOAD_TPCH=1 qod start
```

See [Demo bootstrap](/qod/getting-started/demo) for the full flag reference and what each profile creates.

**Respawn and recovery behavior.** When the manager restarts after a crash or SIGTERM, it reads the persisted node registry and calls `adopt()` on each node that was alive at shutdown. Adopted nodes have their port re-claimed in the allocator and are tracked via `ProcessHandle` so a subsequent `stop()` still delivers SIGTERM. Nodes that died while the manager was down are detected by the health-check loop and replaced automatically. For full details on how the manager handles node failures, drains, and replacements, refer to the Resilience guide.

## Secure in production

- [ ] Choose a strong admin password on the first boot (`qod start` prompts for it, or set `QOD_ADMIN_PASSWORD`, read on that boot only), then rotate each admin name on its own: the default `QOD_ADMIN_USERNAME` seeds two superusers, `admin@localhost.local` and `admin`, with that one password (`qod auth change-password --username <name>`).
- [ ] Replace the shipped Postgres login (`QOD_PG_USER=postgres`, `QOD_PG_PASSWORD=azizam`) with a non-superuser role that holds `CREATEDB`: every database without its own login, and every node that serves one, uses it.
- [ ] Use your own Postgres rather than `QOD_PG_EMBEDDED=true`, and protect its backups and replicas: the control plane stores catalog passwords, object-store keys, the node-key secret and, unless `QOD_SESSION_JWT_SECRET` is set, the session-signing secret.
- [ ] Set `QOD_DUCKLAKE_DATA_PATH` to an absolute path on persistent storage, or an object-store URL, before creating databases: the default `./ducklake/tpch` is relative to the manager's working directory, and DuckLake records the path in each catalog.
- [ ] Leave `QOD_TENANT_FILES_ROOT` unset unless users must load local files: tenant users then reach no local file by path. Once every database's data lies on object storage, also set `QOD_NODE_ALLOW_LOCAL_FILES=false`: nodes then open no local file for anyone, superusers included, from their next start, and boot refuses the two settings together. A database on a local path is blocked by it, the default data path included. See [Local files off](./hardening.md#local-files-off).
- [ ] The REST port, the FlightSQL edge and the native front door listen on every interface (`QOD_ON_DEMAND_HOST`, `PROXY_HOST`, `QOD_QUACK_HOST`, all `0.0.0.0`): set `127.0.0.1` for each one that only local clients use.
- [ ] Block the node port range (`QOD_MIN_PORT`..`QOD_MAX_PORT`, 21900 to 22500) at the host firewall: nodes listen on every interface, and only the manager, on the same host, calls them.
- [ ] Put a TLS-terminating reverse proxy in front of `:20900` before any remote browser or CLI uses it (the REST port speaks plain HTTP), keep TLS on the FlightSQL edge with a CA-signed certificate, and keep `:9494` on loopback or turn its TLS on (see [TLS](./tls.md)).

See [Security hardening](./hardening.md#recommended-posture-for-untrusted-tenants) for the controls to add before tenants you do not fully trust connect.
