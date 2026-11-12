---
id: install
title: Installation
description: "Install Quack on Demand as a Docker image or a single jar driven by the qod CLI, from uvx demo mode to a durable DuckDB gateway."
keywords: ["install", "docker", "uvx", "pip install qod", "duckdb gateway"]
---

Quack on Demand ships as a Docker image and as a single uber-jar driven by the `qod` CLI (`pip install qod`, or no install at all with `uvx`). The fastest way to evaluate it is [Demo mode](/qod/getting-started/quickstart#demo-mode-self-contained-no-postgres) via `uvx qod@latest serve --demo`. For a durable deployment, two paths are supported: Docker, and the native jar via [`qod start`](#native-jar-qod-start). Both run on **Linux, macOS, and Windows** (Windows support is experimental; see [Run on Windows](#run-on-windows) below). GitHub Releases hosts the raw jar artifacts, but you should rarely need to download one by hand - every path below fetches what it needs.

## Docker

The published image is `starlakeai/quack-on-demand`. Use `scripts/docker/run-docker.sh` to pull and run it against an external Postgres:

```bash
PG_HOST=db.internal PG_PASSWORD=*** ./scripts/docker/run-docker.sh
```

The script requires `PG_HOST` and `PG_PASSWORD`. Key options:

| Variable | Default | Description |
|---|---|---|
| `QOD_VERSION` | `latest` | Image tag to pull |
| `PG_PORT` | `5432` | Postgres port |
| `PG_USER` | `postgres` | Postgres user |
| `MANAGER_PORT` | `20900` | Host port for REST + admin UI |
| `EDGE_PORT` | `31338` | Host port for FlightSQL edge |
| `QUACK_PORT` | `9494` | Host port for the native Quack front door (DuckDB `ATTACH`) |
| `TLS` | `false` | Enable FlightSQL TLS inside the container |
| `ADMIN_PASSWORD` | `admin` | Admin login password, used on the first boot only (`QOD_ADMIN_PASSWORD` also works and wins). Rotate it afterwards with `qod auth change-password`. |
| `AUTH` | `true` | Database password auth for FlightSQL and the admin login. Only `true` is accepted: with `false` the manager would have no FlightSQL authenticator and refuse to boot, so the script refuses first. |
| `BUILD` | `0` | Set to `1` to build the image from the local Dockerfile instead of pulling |

To pin a version or use the latest snapshot:

```bash
QOD_VERSION=0.3.2 PG_HOST=... PG_PASSWORD=*** ./scripts/docker/run-docker.sh
QOD_VERSION=latest-snapshot PG_HOST=... PG_PASSWORD=*** ./scripts/docker/run-docker.sh
```

**Note:** do not mix Docker and native-jar runs against the same catalog DB. DuckLake records the absolute data path in Postgres metadata. Inside the container that path is `/app/ducklake/<db>`; natively it is `<host-cwd>/ducklake/<db>`. Use a different `PG_DBNAME` (or `QOD_PG_DBNAME`) per mode, or wipe the data directory between switches.

## Native jar (`qod start`)

`qod start` runs a real manager on your machine against your own Postgres, with no repository checkout: it downloads the release jar from GitHub Releases (verified against the published sha256), self-installs the DuckDB CLI + `libduckdb` at the pinned ABI, and launches QoD with the right settings. Every node runs `qod-node`, QoD's own executable on the official DuckDB library: the jar bundles it for Linux and macOS (x86_64, aarch64) and installs it beside the `libduckdb` it loaded, and `QOD_NODE_BIN` points the manager at another build. The manager refuses to boot without one, or on one built for another node protocol or DuckDB release.

### Prerequisites

- **Postgres 16 or later, reachable.** Installers for all platforms are at [postgresql.org/download](https://www.postgresql.org/download/) (Windows users can also grab the [EDB installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) directly). The control plane stores all state in a dedicated database (default name `qod`) on `localhost:5432`; point `QOD_PG_HOST` / `QOD_PG_PORT` / `QOD_PG_USER` / `QOD_PG_PASSWORD` at yours - or run `uvx qod@latest setup` once to store them (guided prompts; a real shell export still wins; see [`qod setup`](/qod/reference/cli#qod-setup)). When `psql` is on `PATH`, `qod start` creates the control-plane database up front (idempotent); without it the manager creates what it needs on first connection.

  If you do not have a local Postgres instance, the quickest path is:

  ```bash
  docker run -d --name qod-pg \
    -e POSTGRES_PASSWORD=azizam \
    -p 5432:5432 \
    postgres:16-alpine
  ```

- **Java 25+ is found, not required.** `qod start` and `qod serve` use `JAVA_HOME` or `java` on `PATH` when a Java 25+ runtime is present; otherwise they download a cached Temurin 25 JRE (about 50 MB, one time, no prompt). On Windows on ARM, which Temurin 25 does not cover, they download the Microsoft Build of OpenJDK 25. `JAVA_BIN` forces a specific binary; `JAVA_OPTS` adds Java options (e.g. `-Xmx2g`).
- **DuckDB is self-installed** (CLI + `libduckdb` at the ABI libquackwire links against) into the user cache dir - a system duckdb at the wrong ABI would crash the first node spawn, so it is never used. `DUCKDB_VERSION` / `DUCKDB_CACHE_DIR` override the pin and location; air-gapped operators can pre-populate `$DUCKDB_CACHE_DIR/$VERSION/{bin,lib}` and no network fetch happens.

### Where downloads are cached

Everything `qod start` fetches lands in the per-user cache directory, keyed by version, and is reused on every later run:

| What | Location (macOS) | Location (Linux) | Override |
|---|---|---|---|
| Manager jars | `~/Library/Caches/qod/jars` | `~/.cache/qod/jars` | `JAR_CACHE_DIR` |
| Java 25 JRE (only when no system Java 25+) | `~/Library/Caches/qod/jre-25` | `~/.cache/qod/jre-25` | - |
| DuckDB CLI + `libduckdb` | `~/Library/Caches/qod/{bin,lib}` | `~/.cache/qod/{bin,lib}` | `DUCKDB_CACHE_DIR` |

On Windows the root is `%LOCALAPPDATA%\qod\Cache`. Jars are named `quack-on-demand-assembly-<version>.jar`, so several releases coexist; deleting the directory only costs a re-download. Durable state (DuckLake data, TLS certs) is deliberately kept elsewhere, under `~/Library/Application Support/qod` (macOS) or `~/.local/share/qod` (Linux) - wiping the cache is safe, wiping that is not.

Running through `uvx qod@latest ...` adds one more layer: uv caches the `qod` Python package itself under `~/.cache/uv` (`uv cache dir`). That holds only the small CLI, never the manager jar.

**Offline runs.** When GitHub cannot be reached, `qod start` does not fail: it starts the newest manager jar already in the cache (preferring the release this CLI build pins, when that one is cached) and says which version it picked. Only an explicit `--version X.Y.Z` that is neither cached nor downloadable is a hard error, since substituting a different manager behind your back would be worse; the message then lists what is cached so you can pick one. With an empty cache and no network there is nothing to run, so that too is an error.

### Run from Linux/MacOS

```bash
uv tool install qod            # or: pip install qod

qod start                      # latest release
QOD_VERSION=0.3.8 qod start    # pinned release
qod start --jar path/to/quack-on-demand-assembly-X.Y.Z.jar   # a jar you built
```

When your Postgres is not on `localhost:5432` with the default credentials,
the commands above need `QOD_PG_*` in the environment - and because `uvx`
runs the CLI without any installation, there is no obvious place to keep
those exports: every new terminal means re-exporting them or prefixing each
command (`QOD_PG_HOST=db QOD_PG_PASSWORD=... uvx qod@latest start`). That is what
[`qod setup`](/qod/reference/cli#qod-setup) is for - run it once and answer
the prompts:

```bash
uvx qod@latest setup                  # Postgres coordinates, admin username, auth/TLS
uvx qod@latest start                  # now works bare, in any terminal, from anywhere
```

It stores the answers in the CLI config file (mode 0600, path printed on
completion, `--show` to inspect with secrets redacted). A real shell export
still overrides any stored value on a given run, and the self-contained
`qod serve --demo` (and its deprecated alias `qod start --demo`) deliberately ignores the stored config.

On first run against a freshly-provisioned Postgres, Liquibase applies the control-plane schema. The admin UI is at `http://localhost:20900/ui/`; log in as `admin` with the password the first `qod start` asked for (it is set on the first boot only; see [Configuration model](#configuration-model) below).

The FlightSQL edge listens on `localhost:31338` with TLS on by default, and the native Quack front door (for DuckDB clients) on `localhost:9494` with TLS off by default. Durable state (the self-signed certs, and the default DuckLake data path unless `QOD_DUCKLAKE_DATA_PATH` is set) lives under the platform user data dir (`~/.local/share/qod` on Linux, `~/Library/Application Support/qod` on macOS).

To stop the manager and its quack nodes, either press Ctrl-C in the terminal running `qod start` (the CLI supervises QoD and runs the same graceful teardown) or, from anywhere:

```bash
qod stop
```

Both paths SIGTERM the manager and every node, wait up to `FORCE_AFTER` seconds (default 10), then escalate to SIGKILL, so no orphaned node processes are left holding ports.

#### Seeding the demo dataset for a quick smoke test

Pass `LOAD_TPCH=1`, `LOAD_TPCDS=1`, and/or `LOAD_SSB=1` to seed each benchmark independently; the loaders run in the background using the self-installed DuckDB - no extra steps.

```bash
LOAD_TPCH=1 qod start                          # TPC-H only (acme, ~10 s)
LOAD_TPCDS=1 qod start                         # TPC-DS only (globex, ~30 s)
LOAD_SSB=1 qod start                           # SSB star schema only (acme, ~15 s)
LOAD_TPCH=1 LOAD_TPCDS=1 qod start             # TPC-H + TPC-DS
LOAD_TPC=1 qod start                           # legacy shortcut for all three
```

Each flag seeds the matching demo dataset: `acme` loaded with TPC-H (8 tables in schema `tpch1`), `globex` loaded with TPC-DS (24 tables in schema `tpcds1`), and/or the SSB star schema (5 tables in schema `ssb1`, derived from TPC-H dbgen and living next to `tpch1` in the `acme_tpch` tenant-db). The bundled manifest `bootstrap-demo.yaml` (imported from the jar's classpath) declares the tenants, roles, groups, and users; see the [Access control model](/qod/operating/rbac-model) for the full ACL matrix.

For a completely fresh start (drops the control-plane DB and wipes local state directories before booting; requires `psql` for the DB drops):

```bash
NUKE=1 LOAD_TPCH=1 LOAD_TPCDS=1 qod start
```

To front a single DuckDB instance instead of the multi-tenant demo, `DEMO=minimal` imports `bootstrap-demo-minimal.yaml`: one tenant (`acme`), one pool (`bi`), one dual node serving both reads and writes, and the analyst RLS/CLS demo. `DEMO=full` is the default and covers the multi-tenant, multi-pool, and federation demos. The profile is only consulted when a `LOAD_*` flag is set and `QOD_BOOTSTRAP_YAML` is unset; bootstrap only imports into a fresh control plane, so switch profiles with `NUKE=1`. `DEMO=minimal` with `LOAD_TPCDS` warns and skips the TPC-DS loader (no `globex` tenant in this profile).

```bash
NUKE=1 DEMO=minimal LOAD_TPCH=1 qod start
```

### Run on Windows

:::warning Experimental
Windows support is **experimental**. The `qod` launcher needs release **0.3.8 or later** (older releases predate the `demo`/`start` subcommand support and are refused).
:::

The manager runs natively on Windows - no WSL, no Docker. `pip install qod` installs the same `qod.exe` entry point, and `qod serve --demo` / `qod serve` / `qod start` work as on Linux/macOS: Java 25 is auto-provisioned when missing (the Microsoft Build of OpenJDK 25 on ARM), DuckDB (CLI + `duckdb.dll`) is self-installed, and Quack nodes are spawned through the bundled PowerShell mirror of the node-spawn script. The node executable, `qod-node-windows-<arch>.exe`, is too large to bundle in the jar: `qod start` and `qod serve` download the one of the manager's release (sha256-checked, cached under `qod-node/<release>/`) and set `QOD_NODE_BIN`.

```powershell
pip install qod
$env:QOD_PG_HOST        = 'localhost'
$env:QOD_PG_PASSWORD    = 'hunter2'
$env:QOD_ADMIN_PASSWORD = 'change-me'
qod start
```

**Current Windows gaps:** `qod stop` is not implemented (kill the java process with `taskkill /PID <pid> /T`), and the `LOAD_*` benchmark seeders are bash-only through `qod start` (it warns and skips them; run the PowerShell loaders `scripts\load-*-dbgen.ps1` from a checkout instead).

**Client path.** The manager talks to its nodes through the native client `quackwire.dll` only (there is no embedded JDBC fallback). The jar bundles it for `windows-x86_64` and `windows-aarch64` and loads the one for the JVM's own `os.arch`, so a Windows on ARM host (e.g. Parallels on Apple Silicon) needs an ARM64 Java runtime; a platform with no bundled binary, or a native that cannot load, refuses to boot with a message naming the expected file.

**Building the Windows native (`quackwire.dll`), optional.** Requires MSVC (Visual Studio Build Tools) + CMake + `sbt`. Assemble a `DUCKDB_HOME` with `duckdb.lib` plus the full `duckdb/` include tree (see `.github/workflows/quackwire.yml`, step `Install libduckdb v${{ env.DUCKDB_VERSION }} (Windows)`), then:

```powershell
$env:DUCKDB_HOME = 'C:\path\to\duckdb-home'
cmake -S native\quackwire -B native\quackwire\build -DCMAKE_BUILD_TYPE=Release -DDUCKDB_HOME="$env:DUCKDB_HOME"
cmake --build native\quackwire\build --config Release
New-Item -ItemType Directory -Force libquackwire\binaries\windows-x86_64 | Out-Null
Copy-Item native\quackwire\build\Release\quackwire.dll libquackwire\binaries\windows-x86_64\
sbt assembly            # bundles native/windows-x86_64/quackwire.dll
qod start --jar distrib\quack-on-demand-assembly-<version>.jar
```

### Build from source

```bash
sbt assembly
qod start --jar distrib/quack-on-demand-assembly-*.jar
```

To run the jar manually instead:

```bash
java -jar distrib/quack-on-demand-assembly-*.jar
```

The assembly output lands in `distrib/quack-on-demand-assembly-<version>.jar`. The jar carries the `Add-Opens` manifest attribute covering `java.base/java.nio` and `java.base/sun.nio.ch`, which Arrow Flight's unsafe allocator needs on Java 17+. No extra `--add-opens` flags are needed on the command line.

Note: `sbt compile` and `sbt assembly` also run `npm ci` and `npm run build` inside the `ui/` directory as a resource generator, so the React admin UI is bundled automatically. There is no separate UI build step.

## The CLI beyond launching

The same `qod` command drives the whole REST surface and runs SQL against the
FlightSQL edge:

```bash
qod login --url http://localhost:20900 --username admin
qod tenant list
```

See the [CLI section](/qod/cli/) for a tour.

## Configuration model

Every scalar in `application.conf` accepts a matching `QOD_*` environment variable override (FlightSQL edge keys use the `PROXY_*` prefix). The bundled `application.conf` is baked into the jar at build time, so you should use environment variables rather than editing it directly.

**Defaults you must change before production:**

| Setting | Env var | Insecure default |
|---|---|---|
| Admin password | `QOD_ADMIN_PASSWORD` | none for the jar (no admin is seeded until you set it on the first boot); `admin` under the Docker launchers |
| Postgres password | `QOD_PG_PASSWORD` | `azizam` |

There is no static REST API key: every REST, MCP and SCIM caller is a `qod login` session or a personal access token (`qod auth pat create`), and a manager with a non-empty `QOD_API_KEY` refuses to boot. The session signing secret needs no pinning either: when `QOD_SESSION_JWT_SECRET` is unset, the first boot generates one and stores it in the control-plane database, so sessions survive restarts and every HA replica shares it (boot logs `session secret: ...` naming the source, never the value). Pin it from an external secret store when control-plane backups or replicas are less trusted than the manager, since a read of that database otherwise yields a key that forges sessions.

Other commonly used variables:

| Setting | Env var | Default |
|---|---|---|
| Manager REST port | `QOD_ON_DEMAND_PORT` | `20900` |
| FlightSQL edge port | `PROXY_PORT` | `31338` |
| FlightSQL TLS on/off | `PROXY_TLS_ENABLED` | `true` |
| Native Quack front door port | `QOD_QUACK_PORT` | `9494` |
| Native Quack front door TLS on/off | `QOD_QUACK_TLS_ENABLED` | `false` |
| Postgres host | `QOD_PG_HOST` | `localhost` |
| Postgres user | `QOD_PG_USER` | `postgres` |
| Control-plane database | `QOD_PG_DBNAME` | `qod` |
| Admin usernames | `QOD_ADMIN_USERNAME` | `admin@localhost.local,admin` |
| Folder under which tenants authorize local file folders | `QOD_TENANT_FILES_ROOT` | unset (no local folder can be authorized) |
| S3 endpoints users' own keys may target | `QOD_USER_S3_ALLOWED_ENDPOINTS` | unset (AWS only) |

Per-statement authorization is always on: every node judges each tenant statement against the user's grants (or the tenant's OPA policy), and the former `QOD_ACL_ENABLED`, `QOD_ACL_FILTERED_METADATA`, `QOD_ACL_DIALECT` and `QOD_NODE_LOCKDOWN` switches make the manager refuse to boot. See [Upgrading to 0.11.0](../operating/upgrading.md).

Extension settings are fixed when a node starts: `allow_community_extensions`, `allow_unsigned_extensions` and `autoinstall_known_extensions` are false on every node, before its database opens, so no init SQL or session can turn them on. Set `QOD_NODE_ALLOW_COMMUNITY_EXTENSIONS`, `QOD_NODE_ALLOW_UNSIGNED_EXTENSIONS` or `QOD_NODE_AUTOINSTALL_KNOWN_EXTENSIONS` to `true` on the manager to allow one (it applies at each node's next start), and install an extension a statement needs at node start with `INSTALL <name>;` in a database or pool `initSql` rather than relying on DuckDB downloading it.

For the full list of configuration keys, see the [Configuration reference](/qod/reference/configuration).