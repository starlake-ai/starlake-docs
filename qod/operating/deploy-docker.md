---
id: deploy-docker
title: Docker deployment
description: "Run the whole DuckDB gateway as a Docker Compose stack: manager, Postgres metastore and DuckDB nodes in one container on one host."
keywords: ["duckdb docker", "docker compose", "single node", "deployment"]
---

## When to use

The Docker Compose stack runs the whole control plane as containers: the manager (REST + admin UI + FlightSQL edge) plus its Postgres metastore, with every DuckDB Quack node spawned as a child process inside the manager container. It is the right choice for:

- A single-host deployment where you want the manager and its Postgres bundled and supervised together, with persistent state on the host.
- A reproducible demo or evaluation host that boots with one command and no Java, sbt, or Node toolchain on the box.
- Running off a dedicated data disk or NFS mount: the persistent folders are bind-mounted and each one accepts an external host path (see [Data folders](#data-folders-external-bind-mounts) below).

For first-boot-to-first-query, see the [Quickstart](/qod/getting-started/quickstart). For a single manager container pointed at an external Postgres you already run, see the Docker section of [Installation](/qod/getting-started/install). For multi-host or orchestrated deployments, use the [Kubernetes backend](/qod/operating/deploy-kubernetes).

## What comes up

`docker compose up` (or the `scripts/run-docker-compose.sh` wrapper) starts two services:

| Service | Role |
|---|---|
| `postgres` | Control-plane database `qod` (the `qodstate_*` tables) plus every tenant database (`${tenant}_${tenantDb}`, e.g. `tpch_tpch1`) the manager provisions. DuckLake's `__ducklake_*` catalog lives inside each tenant database. |
| `quack` | The manager: REST + admin UI on `:20900`, the FlightSQL edge on `:31338`, the native Quack front door on `:9494` (DuckDB `ATTACH`), and the child Quack node port range. |

Three optional profiles add services only when you ask for them: `seaweedfs` (an in-network S3 object store), `observability` (Prometheus + Grafana), and `starflow` (the Starflow UI, signed in from the admin UI). See [Profiles](#optional-profiles) below.

## Boot it

The `scripts/run-docker-compose.sh` wrapper handles port preflight, profile auto-detection, optional demo seeding, and readiness waiting. `QOD_VERSION` picks where the image comes from: a published tag (default `latest`) is pulled, `BUILD` builds it from the repo's Dockerfile, and `LOCAL` reuses the image a previous `BUILD` produced:

```bash
# Pull the published image starlakeai/quack-on-demand and start (default).
./scripts/run-docker-compose.sh

# Pin a version.
QOD_VERSION=0.3.2 ./scripts/run-docker-compose.sh

# Build the image from this repo's Dockerfile instead of pulling.
QOD_VERSION=BUILD ./scripts/run-docker-compose.sh

# Reuse the image from a previous BUILD, without pulling or rebuilding.
QOD_VERSION=LOCAL ./scripts/run-docker-compose.sh
```

Settings come from a `.env` file (copied from `.env.example` on first run). Edit it before booting, or pass the same keys as environment variables. The admin UI is at `http://localhost:20900/ui/`; log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` (defaults `admin` / `admin`).

Plain `docker compose up --build` also works if you do not want the wrapper's preflight and seeding.

## Data folders (external bind mounts)

All persistent state is bind-mounted onto the host. Each mount defaults to a repo-relative folder, but every host path accepts an **external** override (an absolute path such as `/data/qod/pgdata`, or a relative one) so the data can live off the repo on a dedicated disk or NFS mount. Set the override in `.env` or as an environment variable:

| Host path (default) | Container path | Override | Holds |
|---|---|---|---|
| `./pgdata` | `/var/lib/postgresql/data` | `PGDATA_DIR` | Postgres data: the `qod` control plane plus every tenant database. |
| `./ducklake` | `/app/ducklake` | `DUCKLAKE_DIR` | DuckLake Parquet data files, one subdirectory per tenant database. |
| `./certs` | `/app/certs` | `CERTS_DIR` | Self-signed FlightSQL TLS cert and key, auto-generated on first boot. |
| `./seaweedfs` | `/data` | `SEAWEEDFS_DIR` | SeaweedFS object data (only with the `seaweedfs` profile). |
| `./seaweedfs-config` | `/etc/seaweedfs` | `SEAWEEDFS_CONFIG_DIR` | SeaweedFS S3 credentials (only with the `seaweedfs` profile). |
| `./starflow` | `/app/starlake/projects`, `/app/starlake/dags` | `STARFLOW_DIR` | Starflow projects and generated DAGs (only with the `starflow` profile). Its metadata lives in the `starlake` database under `./pgdata`. |

For example, to keep the metastore and DuckLake data under `/data`:

```bash
PGDATA_DIR=/data/qod/pgdata DUCKLAKE_DIR=/data/qod/ducklake \
  ./scripts/run-docker-compose.sh
```

When DuckLake writes to an S3-compatible bucket instead of the filesystem (`QOD_DUCKLAKE_DATA_PATH=s3://...`), the `./ducklake` mount is unused; the catalog persists the `s3://` URL and every Quack node resolves it identically regardless of host. See [Object storage](#object-storage-s3-compatible).

:::caution
`NUKE=1 ./scripts/run-docker-compose.sh` asks you to type the project name on a terminal before wiping (non-tty runs skip the prompt) and only wipes the repo-relative defaults (`./pgdata`, `./ducklake`, `./certs`, `./seaweedfs`, `./seaweedfs-config`, `./starflow`, plus a legacy `./rustfs` left by checkouts that ran the briefly-bundled RustFS). External folders you point these overrides at are **not** auto-wiped; remove them by hand.
:::

Do not mix a Docker run and a native-jar run against the same catalog database. DuckLake records the absolute data path in Postgres metadata: inside the container it is `/app/ducklake/<db>`, natively it is `<host-cwd>/ducklake/<db>`. Use a different control-plane database name per mode, or wipe the data between switches.

## Ports

The wrapper exposes these host ports (override in `.env`):

| Env var | Default | Purpose |
|---|---|---|
| `MANAGER_PORT` | `20900` | REST + admin UI |
| `EDGE_PORT` | `31338` | FlightSQL edge |
| `QUACK_PORT` | `9494` | Native Quack front door (DuckDB `ATTACH 'quack:host:9494'`) |
| `PG_PORT` | `5432` (`15432` in `.env.example`) | Postgres. With `5432`, the wrapper bumps it to `15432` in `.env` when the host port is busy. |
| `QUACK_MIN_PORT` / `QUACK_MAX_PORT` | `21900` / `22500` | Child Quack node range |
| `STARFLOW_PORT` | `9900` | Starflow UI (only with the `starflow` profile) |

## Fresh start and seeding

```bash
# Tear down the stack and wipe the repo-relative state folders, then boot clean.
NUKE=1 ./scripts/run-docker-compose.sh

# Seed the demo tenants before the manager is ready.
# Numeric value = scale factor for TPC-H, TPC-DS, and the SSB star schema.
# (SF=1 is roughly 6M lineitem rows for TPC-H.)
LOAD_TPC=1 ./scripts/run-docker-compose.sh

# Both flags combine.
NUKE=1 LOAD_TPC=1 ./scripts/run-docker-compose.sh

# Single-DuckDB profile: one tenant, one pool, one dual node.
NUKE=1 DEMO=minimal LOAD_TPCH=1 ./scripts/run-docker-compose.sh
```

`LOAD_TPC=1` seeds two demo tenants inside the container: `acme` loaded with TPC-H (8 tables in schema `tpch1`, database `acme_tpch`) plus the SSB star schema derived from it (5 tables in schema `ssb1`, same database), and `globex` loaded with TPC-DS (24 tables in schema `tpcds1`, database `globex_tpcds`). Use `LOAD_TPCH` / `LOAD_TPCDS` / `LOAD_SSB` to seed each independently. The bundled manifest `bootstrap-demo.yaml` declares the tenants, pools, roles, groups, and users; `QOD_BOOTSTRAP_YAML=classpath:bootstrap-demo.yaml` is injected into `.env` automatically so the manager imports it on startup.

`DEMO=minimal` injects `bootstrap-demo-minimal.yaml` instead - the shape for fronting a single DuckDB/DuckLake database: one tenant (`acme`), one pool (`bi`), one dual node serving both reads and writes, and the analyst RLS/CLS demo. `DEMO=full` is the default and covers the multi-tenant, multi-pool, and federation demos. The profile is only consulted when a `LOAD_*` flag is set and `QOD_BOOTSTRAP_YAML` is unset; bootstrap only imports into a fresh control plane, so switch profiles with `NUKE=1`. `DEMO=minimal` with `LOAD_TPCDS` warns and skips the TPC-DS loader (no `globex` tenant in this profile).

You can also seed a running stack directly:

```bash
docker compose exec -e PG_HOST=postgres -e DB_NAME=acme_tpch -e SCHEMA_NAME=tpch1 \
  -e DATA_PATH=/app/ducklake/acme_tpch -e SF=1 quack /app/scripts/load-tpch-dbgen.sh
docker compose exec -e PG_HOST=postgres -e DB_NAME=globex_tpcds -e SCHEMA_NAME=tpcds1 \
  -e DATA_PATH=/app/ducklake/globex_tpcds -e SF=1 quack /app/scripts/load-tpcds-dbgen.sh
```

## Optional profiles

Activate with `--profile` on `docker compose`, or via `PROFILES=...` on the wrapper.

### Object storage (S3-compatible)

Set `QOD_DUCKLAKE_DATA_PATH` to an `s3://` URL and fill in the `QOD_S3_*` credentials to write DuckLake Parquet to a bucket instead of the `./ducklake` bind mount. Two options:

- **Bundled SeaweedFS** (no external dependency). Bring it up with `docker compose --profile seaweedfs up -d`; the wrapper auto-activates this profile when `QOD_S3_ENDPOINT` (exported, or in `.env`) points at `seaweedfs:8333`. Pair with `QOD_DUCKLAKE_DATA_PATH=s3://${S3_BUCKET}/<db>`. SeaweedFS auto-creates buckets on first write, so no separate bucket step is needed. The Filer UI on `:8888` doubles as a file browser.
- **External S3** (AWS, R2, MinIO, GCS HMAC). Leave the profile off and set the bucket plus credentials; omit `QOD_S3_ENDPOINT` to use the AWS default.

The `.env.example` file has ready-to-uncomment blocks for both. The `spawn-quack-node.sh` and TPC-H loader detect the `s3://` scheme, install DuckDB's `httpfs`, and `CREATE SECRET` so every node reads and writes Parquet against the bucket.

### Observability

```bash
docker compose --profile observability up -d
# or: PROFILES=observability ./scripts/run-docker-compose.sh
```

Prometheus scrapes the in-network `quack` service; Grafana serves a pre-provisioned dashboard on `:3000` (anonymous admin, so do not expose it to a public network as-is). See the Resilience and metrics references for what is scraped.

### Starflow

The `starflow` profile runs [Starflow](/starflow/overview) (the Starlake API + UI) next to the manager, paired with it over SSO: the admin UI's [Workbench](/qod/operating/admin-ui#workbench) entry opens Starflow already signed in, and Starflow queries the gateway as the signed-in QoD user. It is the Docker equivalent of `qod start --with-starflow`.

```bash
STARFLOW_ENABLED=true ./scripts/run-docker-compose.sh
```

The wrapper activates the profile, generates the two shared secrets into `.env` when they are missing (`API_KEY` and `SESSION_JWT_SECRET`, printed by name only), picks the edge URL Starflow uses from `TLS`, and waits for Starflow before printing its URL (`http://localhost:9900` by default). The first run builds the Starflow image locally (`docker/starflow`), which downloads a Starflow release of several hundred MB.

With plain `docker compose`, set the secrets yourself; both must stay stable across restarts, or SSO and Starflow's calls to the manager break:

```bash
cat >> .env <<EOF
STARFLOW_ENABLED=true
COMPOSE_PROFILES=starflow
API_KEY=$(openssl rand -hex 32)
SESSION_JWT_SECRET=$(openssl rand -hex 48)
EOF
docker compose up -d --build
```

A one-shot `starflow-db-init` service creates the `starlake` metadata database on the compose Postgres, then the `starflow` service starts. If `STARFLOW_ENABLED`, `API_KEY` or `SESSION_JWT_SECRET` is missing, `starflow-db-init` exits with an error naming it and Starflow does not start. Without the profile, the manager runs with the Starlake integration off, exactly as before.

| Env var | Default | Purpose |
|---|---|---|
| `STARFLOW_ENABLED` | `false` | Turns the profile on for the wrapper, and the Workbench entry on in the manager. |
| `API_KEY` | (generated by the wrapper) | Key Starflow presents to the manager's REST API. |
| `SESSION_JWT_SECRET` | (generated by the wrapper) | Signs QoD sessions and the tokens Starflow mints for the edge. Pinning it also keeps admin UI sessions alive across restarts. |
| `STARFLOW_VERSION` | `1.8.8` | Starflow release baked into the image. |
| `STARFLOW_PORT` | `9900` | Host port of the Starflow UI. |
| `STARFLOW_URL` / `STARFLOW_DOMAIN` | `http://localhost:9900` / `localhost` | Browser-facing Starflow URL and its host, for clients on other machines. |
| `QOD_PUBLIC_URL` | `http://localhost:20900` | Browser-facing manager URL Starflow links back to. |
| `STARFLOW_DB` | `starlake` | Starflow metadata database on the compose Postgres. |
| `STARFLOW_QOD_FLIGHT_URL` | `http://quack:31338` | Edge URL Starflow queries through; the wrapper switches it to `https://` when `TLS=true`. |

### Fleet mode (manager and workers as containers)

`docker-compose.fleet.yml` layers on the base file and runs the stack with the [fleet runtime](deploy-fleet.md#run-servers-as-docker-containers): the manager schedules nodes onto two worker containers (`fleet-worker-1` on port `21901`, `fleet-worker-2` on `21902`) instead of spawning them itself. It needs a join token in `.env` and the SeaweedFS profile:

```bash
echo "FLEET_JOIN_TOKEN=$(openssl rand -hex 24)" >> .env
docker compose -f docker-compose.yml -f docker-compose.fleet.yml --profile seaweedfs up -d --build
```

## Corporate proxy

When the host needs an HTTP proxy to reach the public internet (for DuckDB extension downloads from `extensions.duckdb.org`), set `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` in `.env`. Compose forwards them into both the build and the runtime, and the manager translates them into DuckDB's `SET http_proxy` before `INSTALL`. The in-network hostnames (`postgres`, `seaweedfs`) are always added to `NO_PROXY` so intra-stack traffic and S3 PUTs bypass the proxy. Note that `docker pull` itself reads the Docker daemon's proxy config, not these variables.

## Before exposing beyond localhost

The defaults are tuned for a fast local smoke test. Change these before any non-local exposure:

| Setting | Env var | Insecure default |
|---|---|---|
| Admin password | `ADMIN_PASSWORD` | `admin` |
| Postgres password | `PG_PASSWORD` | `azizam` |
| REST API key | `API_KEY` | unset (open API) |
| Session signing secret | `SESSION_JWT_SECRET` | unset (random per boot; generated into `.env` with the `starflow` profile) |
| FlightSQL TLS | `TLS` | `false` in compose |

Enable edge TLS with `TLS=true` (clients then connect with `grpc+tls://...`); see [TLS](/qod/operating/tls). For the full set of tunable keys, see the [Configuration reference](/qod/reference/configuration).
