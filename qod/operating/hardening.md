---
id: hardening
title: Security hardening
description: "Security hardening checklist for exposing a DuckDB gateway to untrusted users: defaults to change, secrets, network and the SQL surface."
keywords: ["duckdb security", "hardening", "production security"]
---

Quack on Demand runs tenant-supplied SQL on shared infrastructure. Since 0.11.0
the nodes enforce what tenant SQL may reach on every pool, with no switch to turn
it off. This page describes that enforcement and collects the controls you add
before exposing the gateway to untrusted tenants: pod security, network policy,
the secrets nodes are keyed with, and catalog-reader bounding. None of them change
behavior for a superuser on a single-tenant local deployment.

Read this alongside [TLS](tls.md) (encrypt the FlightSQL edge),
[Encryption at rest](encryption.md) (encrypt the stored data),
[Authentication](authentication.md) (require credentials), and
[RBAC](rbac-model.md) (scope table access). Hardening assumes those are already
in place: it protects the node process and the network, not the front door.

## Threat model

The controls here address a tenant who authenticates legitimately and then sends
hostile SQL: reading node-local files, attaching arbitrary databases, installing
extensions, exhausting the control-plane database, or reaching the network from a
node pod. They do not replace a runtime sandbox. If you run genuinely untrusted
code and need a hard boundary, put each tenant in its own Kubernetes namespace
and consider a sandboxed runtime (gVisor, Kata); the controls below are
defense-in-depth layered under that, not a substitute for it.

## Node enforcement (always on)

Every node runs `qod-node`, which judges each statement of a user who is not a
superuser on the plan DuckDB bound for it, before it runs. It asks the manager
replica that opened the session for a verdict, and that replica answers from the
tenant's grants (or its [OPA policy](rbac-model.md#delegating-to-opa)), the
function and setting classification and the file rules. Nothing else checks:
the gateway's own statement screens and table check are gone. There is no ACL
switch and no per-pool lockdown any more: `QOD_ACL_ENABLED`,
`QOD_ACL_FILTERED_METADATA`, `QOD_ACL_DIALECT` and `QOD_NODE_LOCKDOWN` set to any
value make the manager refuse to start, naming the variable to unset (see
[Upgrading to 0.11.0](./upgrading.md)). How grants are matched is in the
[access control model](rbac-model.md).

Whatever the tenant's mode and grants (`*.*.* ALL` included), a caller who is not
a superuser is refused, on every pool:

- **DuckLake catalog internals**: the metadata catalog `__ducklake_metadata_<alias>`
  (it holds the per-file encryption keys), `ducklake_list_files` and
  `ducklake_commit`. A user may still create a plain view over it, but every read
  through that view by anyone but a superuser is refused: a plain view runs with
  its reader's rights.
- **Node-wide settings and node control**: any `SET` / `RESET` / `PRAGMA` of a
  setting not classified as a session setting (`threads`, `memory_limit`,
  `temp_directory`, checkpoint, WAL, logging and profiling knobs, every `quack_*`,
  `debug_*` and `verify_*`), any `SET GLOBAL`, `CHECKPOINT`, and node-control calls
  such as `quack_serve` or `enable_logging`. Set resources at node start instead,
  in a database or pool `initSql` or with `qod pool set-resources`.
- **Credentials and I/O settings**: `CREATE` / `DROP SECRET` in any storage,
  `ATTACH`, `IMPORT` / `EXPORT DATABASE`, and `SET` / `RESET` of the `s3_*`,
  secret, certificate, proxy, HTTP client and cache settings,
  `file_search_path` and `home_directory`.
- **Extensions**: `INSTALL`, `FORCE INSTALL`, `UPDATE EXTENSIONS` and `LOAD`, by
  bare name included. Install and load extensions at node start, in an `initSql`.
- **Node-state introspection**: `duckdb_secrets()`, `which_secret()`,
  `duckdb_settings()`, `current_setting()` of any setting, the logs,
  `duckdb_memory()`, `duckdb_temporary_files()`, `duckdb_databases()`,
  `duckdb_extensions()` and `pragma_storage_info`.
- **Definitions that run with another's rights**: `CREATE MACRO`, trigger DDL
  (tenant admins included) and secure views, plus `pg_get_viewdef` (it would print
  every view's SQL).
- **Anything unclassified**: a function or setting the classification does not
  list (`QoD: function <name> is not classified`, a misspelled name included), and
  a plan shape the node cannot describe.

Refusals read `QoD: <reason>` and are permission errors: FlightSQL
`UNAUTHORIZED`, statement history status `denied`, and a `data-denial` event in
the [audit log](../administration/audit-log.md). A statement refused because no
verdict could be had in time reads `QoD: authorization unavailable, retry` and is
retryable. Superusers and the manager's own work are not decided, but a few
mechanism rules hold for every principal: `SET` / `RESET` of
`disabled_optimizers`, `enable_optimizer`, `debug_disable_optimizer`,
`quack_authentication_function` and `quack_authorization_function`
(`QoD: <name> cannot be changed`), and writes to a
[read-only federated catalog](federation.md).

Verify the posture as a tenant user: `SELECT * FROM read_text('/etc/passwd')`,
`ATTACH ':memory:' AS x` and `SET autoinstall_known_extensions = true` are refused
(`QoD: ...`), while ordinary queries on granted tables still work.

### Files and S3

A tenant user, `*.*.* ALL` included, reads or writes a file by path only through
a file reader or `COPY`, and only under:

- an `s3://` scope the user registered S3 keys of their own for (`qod profile s3
  add <scope> --access-key-id ... --secret-stdin`, or the profile page). The node
  signs that user's requests with those keys only, as secrets of that user's own
  connection. An endpoint other than AWS must be listed in
  `QOD_USER_S3_ALLOWED_ENDPOINTS` (empty, the default, means AWS only). A tenant
  admin can list and remove their users' keys (`qod user s3 list|remove`) but
  never add one;
- a local folder the tenant authorized (`qod tenant location add <tenant>
  <folder>`), which must be absolute and under
  `<QOD_TENANT_FILES_ROOT>/<tenant id>/`. With `QOD_TENANT_FILES_ROOT` unset, the
  default, no local folder can be authorized. Nodes on Windows admit none.

A database's data folder, any tenant's, is never reachable by its path, and any
other scheme (`http(s)`, `gs`, `az`, `r2`) is refused. A file named in a table
position (`FROM 'x.parquet'`) is "table not found" for a tenant user: use the
reader function.

**Keep tenant folders free of symbolic links**, including those an upload
preserves (`rsync -a`, some SFTP clients). The node resolves a path's deepest
existing folder, links included, but does not judge links below it: through a
glob segment or a `COPY` with `PARTITION_BY`, `PER_THREAD_OUTPUT` or `OVERWRITE`,
a link inside an authorized folder can lead out of it, into any tenant's data
folder too, and a `COPY ... OVERWRITE` then deletes files under the link's target.
Users cannot create links with SQL.

Users' S3 keys are stored in plaintext in the control-plane database
(`qodstate_user_s3_credential`) and travel to the nodes signed, not encrypted:
protect its backups and replicas accordingly, and keep manager-to-node traffic on
a private network.

### Local files off

The rules above bind tenant users, and only the paths a statement names. A
superuser still reads any local file the node's OS user can, and a node reads
whatever files a catalog lists, so a DuckLake file list, deletion schedule or
Iceberg manifest can point it at a local path. When every database's data lies on
object storage, close both on the manager:

```bash
QOD_NODE_ALLOW_LOCAL_FILES=false   # quack-on-demand.nodeFiles.allowLocal, default true
```

| Deployment | Where to set it |
|---|---|
| Kubernetes | The chart's `env` (`env.QOD_NODE_ALLOW_LOCAL_FILES=false`): it has no value of its own |
| Single Docker container | The `quack` service's `environment` (`QOD_NODE_ALLOW_LOCAL_FILES: "false"`): the compose file does not pass it from `.env` |
| Local, single server, fleet | The manager's environment: it reaches every node it starts, `qod fleet join` servers included |

It applies at each node's next start, so restart the nodes already running. Each
node's setup then ends by turning DuckDB's external access off: nothing on the node
opens a local path for anyone, superusers included (`Permission Error: Cannot
access file ...`), and no session can turn it back on. DuckDB's own temp directory
and the system's CA bundle stay open, so spills and HTTPS keep working, as do
DuckLake, merges, maintenance, users' S3 keys and Iceberg over REST on object
storage.

The manager checks each node's setting with its health probe. A node that does not
show it (an older image or `qod fleet join`, a node started before the setting, a
switch that failed at init) is unhealthy and not routed to until someone restarts
it, and the pool's `statusDetail` says so.

What it costs:

- A database on a local data path is blocked: its pools start no node, and the boot
  banner and `/api/pool/list` say why. A create or an update that would make one
  answers `400 local_files_off`, and a statement that would wake a suspended pool of
  one is refused at once. A manifest still imports one, so a backup always restores.
  The default data path of a local or Docker install is local: change it first.
- `QOD_TENANT_FILES_ROOT` set with it refuses boot, so users cannot load local files.
- `INSTALL` and `LOAD` are refused at run time, to superusers too. `icu`, `json`,
  `parquet` and `httpfs` always work; `ducklake`, `postgres`, `iceberg` and `avro`
  only where the node's setup loaded them; any other only through a database's or
  pool's `initSql`.
- A federated source that failed at a node's start, or was added to a running node,
  attaches only after a node restart.
- A private CA goes in the system bundle: a `ca_cert_file` at a path of its own is
  refused.
- Views over local files (`qod serve <local file>`) start and read nothing.
- A superuser's `enable_logging` with file storage at a local path aborts the node.

What it leaves open:

- It covers local files only, nothing about what a node's own keys reach on object
  storage (see [the nodes' own credentials](#the-nodes-own-credentials)).
- A superuser can still read and write DuckDB's temp directory and the CA bundle
  files, and a local file a superuser's `initSql` attached stays reachable.
- A node is routable from its start until the first health probe reads it, and no
  probe visits a maintenance or merge node.
- It has not been run on Windows nodes.

### The nodes' own credentials

Nodes open with DuckDB's external file cache and HTTP metadata cache off (both are
shared across connections), turn `aws_default_credentials` off, and reset the S3
settings httpfs copies from `AWS_*` / `DUCKDB_S3_*` environment variables. The
data path's secret is scoped to the data path and its branches. The manager's
`QOD_S3_*` keys (or the instance's credential chain) therefore sign only a
database's own data path: a superuser reading another bucket registers keys too
(`qod profile s3 add`) or creates a scoped secret, and an `initSql` that reads
other buckets needs its own `CREATE SECRET`.

### Extension settings

`allow_community_extensions`, `allow_unsigned_extensions` and
`autoinstall_known_extensions` are false on every node, set before its database
opens, so no `initSql` or session can turn them on. An operator who needs one sets
`QOD_NODE_ALLOW_COMMUNITY_EXTENSIONS`, `QOD_NODE_ALLOW_UNSIGNED_EXTENSIONS` or
`QOD_NODE_AUTOINSTALL_KNOWN_EXTENSIONS` to `true` on the manager (the Helm chart
has no value for them: use its `env`); it applies at each node's next start. With
autoinstall off, a statement that relied on DuckDB downloading a known extension
fails until the extension is installed at node start (`INSTALL <name>;` in a
database or pool `initSql`). Nodes install httpfs and avro themselves, before the
database's `initSql`.

### Init SQL written by tenant admins

A database's or pool's `initSql` written by a superuser (or by the manager: `qod
serve`, a manifest import, a branch) runs as written. One written by a tenant admin
runs under an allowlist: `SET` / `RESET` of a short list of resource and
session-default settings to a literal (`memory_limit`, `threads`, `timezone`, ...),
read-only PRAGMAs, and `INSTALL` / `LOAD` by bare name of a list of DuckDB
extensions. Every other statement is skipped, and the write is refused up front
with `400 init_sql_refused` where the manager can check it. Responses carry
`initSqlTrusted`. Likewise, `sql` [federation sources](federation.md), whose
`setupSql` is free-form, are superuser-only.

### Node keys and the decide URL

Every statement a node runs carries a session handle naming its principal, signed
with that node's own key, which derives from the node-key secret:
`QOD_NODE_KEY_SECRET` when set (at least 32 characters), else a value the first
boot generates and stores in the control-plane database. Unless you pin
`QOD_NODE_KEY_SECRET` from an external secret store, whoever can read that
database (backups, dumps, read replicas) can mint a handle for any principal on
any node: protect it like the secret itself. Under HA set it to the same value on
every replica, or leave it unset on all. Changing it means restarting every node.

Nodes call the replica that minted a handle back at `QOD_INTERNAL_URL` for their
verdicts (boot prints `node decide URL: <url>`). See the
[configuration reference](/qod/reference/configuration) for its defaults; fleet
mode requires it set.

## Pod security context (Kubernetes)

On the Kubernetes backend, every spawned node pod gets a hardened security
context by default (no flag needed):

- **Pod:** `runAsNonRoot: true`, `runAsUser` / `fsGroup` = `1000`
  (env `QOD_K8S_RUN_AS_USER`), `seccompProfile: RuntimeDefault`.
- **Container:** `allowPrivilegeEscalation: false`, all Linux capabilities
  dropped, `readOnlyRootFilesystem: true`.
- **Writable temp:** `emptyDir` volumes at `/tmp` and `/duckdb-tmp` so the manager
  and DuckDB still have scratch space despite the read-only root filesystem.

The kubelet refuses to start a pod that would run as root, so this is enforced,
not advisory. If you supply a [pod template](pools-cohorts.md), its own
`securityContext` fields win field-by-field: set only what you need to relax and
the rest of the hardened defaults still apply.

Change the UID fleet-wide with `QOD_K8S_RUN_AS_USER`. Note that all node pods
share this UID; per-tenant UIDs are not a v1 feature (put tenants in separate
namespaces if you need that separation).

The Helm chart applies an equivalent posture to the manager deployment; both are
values-overridable.

## Network policy (Kubernetes, opt-in)

The Helm chart ships two `NetworkPolicy` templates, off by default. Enable them:

```yaml
networkPolicy:
  enabled: true
```

When enabled you get default-deny ingress and egress with only the necessary
holes:

- **Node pods:** ingress only from manager pods on the node port range; egress to
  the manager pods on TCP 20901, the verdict listener (each statement's
  authorization verdict), DNS, the control-plane Postgres, and the object store.
  A tenant node cannot reach the rest of the cluster or the internet beyond those.
- **Manager:** ingress on the REST/UI port (20900), the FlightSQL edge (31338) and
  the native Quack front door (9494) from `ingressFrom`, plus the verdict listener
  (20901) from the node pods whatever `ingressFrom` says; egress to node pods,
  Postgres, DNS, and optionally SMTP.

The rules match the release namespace only.

Tune the reachable targets through the values block:

```yaml
networkPolicy:
  enabled: true
  nodePortRange: { from: 21900, to: 22500 }
  postgres: { cidr: "10.0.0.0/8", port: 5432 }   # empty cidr = any host on the port
  objectStore: { cidrs: [] }                     # empty = 443 anywhere; tighten in prod
  ingressFrom: []                                # manager ingress peers; empty = anywhere
  smtp: { enabled: false, cidr: "", port: 587 }
  extraEgress: []                                # extra egress rules for federation targets
```

An empty `cidr`/list means "allow on that port" (the safe default for a policy you
are turning on); set real CIDRs before calling it locked down. Add federation
egress targets through `extraEgress`.

The node-pod selector matches the `managed-by: quack-on-demand` label. If you
override the node pod label (`QOD_K8S_POD_LABEL`), update the policy selector to
match, or the node policy will not select any pods.

## Catalog-reader bounding

The manager caches one DuckLake catalog reader per browsed tenant-db, each holding
a small Postgres connection pool. Without bounds, a deployment with many
self-serve tenant-dbs could accumulate enough idle readers to exhaust the
control-plane database's connections.

Two controls keep that in check, both on by default:

- Each cached reader's pool holds **zero idle connections** (`minimumIdle 0`,
  60-second idle timeout, max 2), so an idle reader releases its Postgres
  connections on its own.
- A background sweep **evicts readers unused for 30 minutes**, closing their
  pools. A later browse simply rebuilds the reader.

Tune the cadence and threshold:

```bash
QOD_CATALOG_READER_SWEEP_MIN=10        # how often the sweep runs (minutes)
QOD_CATALOG_READER_IDLE_EVICT_MIN=30   # idle age before a reader is evicted (minutes)
```

The sweep runs on every replica (the cache is per-process), independently of the
[HA leader](resilience.md). No action is needed; the defaults suit most
deployments.

## Security audit

A superuser sees how a deployment stands against the "Secure in production" checklist that ends
each operating page:

- in the console, under **Settings > Security audit**;
- with `qod admin security-audit`: `--json` lists every check, and `--fail-on warn,error` makes a
  warning or an error fail the command too, for a CI gate. A critical finding always exits 3.

Each finding says what was found, what to change, and links to the checklist that explains it. The
statuses:

| Status | Meaning |
|---|---|
| critical | exploitable as configured |
| warning | weakens the posture, or depends on your environment |
| error | the check could not complete within its 5 seconds; the cause is in the manager log |
| ok | checked, nothing to report |
| n/a | the check does not apply here (another runtime, a feature turned off) |

A finding names settings, counts and object names, never a secret's value. The audit reads the
configuration of the replica that answers and the shared control-plane database, and changes
nothing.

## Recommended posture for untrusted tenants

For a gateway exposed to tenants you do not fully trust:

- Grant tenant users only what they need ([RBAC](rbac-model.md)): enforcement is
  always on, but a user created without explicit roles gets the permissive
  built-ins.
- Leave `QOD_TENANT_FILES_ROOT` unset unless users load local files, keep the
  tenant folders free of symbolic links, and list in
  `QOD_USER_S3_ALLOWED_ENDPOINTS` only the S3 endpoints you trust.
- With every database's data on object storage, set
  `QOD_NODE_ALLOW_LOCAL_FILES=false` so that no node opens a local file for anyone
  ([Local files off](#local-files-off)).
- Keep the extension settings at their defaults.
- TLS on the edge ([TLS](tls.md)), a pinned `QOD_SESSION_JWT_SECRET`
  ([Authentication](authentication.md)) and a pinned `QOD_NODE_KEY_SECRET`, both
  from an external secret store when control-plane backups are less trusted than
  the manager. Automation uses personal access tokens: the static API key is gone.
- Keep manager-to-node traffic on a private network.
- On Kubernetes: `networkPolicy.enabled=true` with real CIDRs, the default pod
  security context left on, and one namespace per tenant if you need hard
  isolation.
