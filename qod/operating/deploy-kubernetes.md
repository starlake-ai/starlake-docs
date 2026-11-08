---
id: deploy-kubernetes
title: Kubernetes deployment
description: "Deploy Quack on Demand on Kubernetes: the manager as a pod that spawns DuckDB node pods on demand, per pool, with highly available managers."
keywords: ["duckdb kubernetes", "k8s", "helm", "deployment", "pods"]
---

## When to use

Use the Kubernetes backend when you need multi-node, production-grade deployments. In this mode the manager process runs as a single pod inside your cluster and spawns Quack node pods on demand via the Kubernetes API. Each pool's nodes are independent pods, so they scale and fail independently of the manager.

For single-machine development and testing, use the local backend (`runtimeType=local`) instead.

If you have several servers but no Kubernetes cluster, the [fleet runtime](deploy-fleet.md) (`runtimeType=fleet`) runs one node per server, joined with `qod fleet join`, with the same pools, routing and HA support.

## Configure the backend

Set `quack-on-demand.runtimeType=kubernetes` (or `QOD_RUNTIME_TYPE=kubernetes`) to activate the Kubernetes backend. All `k8s.*` keys are overridable via environment variables.

| Key | Env var | Default | Description |
|-----|---------|---------|-------------|
| `k8s.namespace` | `QOD_K8S_NAMESPACE` | `default` | Kubernetes namespace where node pods and services are created. |
| `k8s.image` | `QOD_K8S_IMAGE` | `starlakeai/quack-on-demand-node:latest-snapshot` | Container image used for Quack node pods. |
| `k8s.serviceAccount` | `QOD_K8S_SERVICE_ACCOUNT` | (unset) | Service account name injected into node pods. Omit to use the namespace default. |
| `k8s.serviceType` | `QOD_K8S_SERVICE_TYPE` | `ClusterIP` | Kubernetes Service type for per-node Services. |
| `k8s.quackPort` | `QOD_K8S_QUACK_PORT` | `8080` | Port the Quack HTTP server listens on inside each node pod. |
| `k8s.startupTimeoutSec` | `QOD_K8S_STARTUP_TIMEOUT_SEC` | `120` | Seconds the manager waits for a new node pod to reach Running phase before aborting. |
| `k8s.podLabel` | `QOD_K8S_POD_LABEL` | `managed-by=quack-on-demand` | Label (`key=value`) applied to every manager-owned pod and Service, used for discovery. |

See [/reference/configuration](/qod/reference/configuration) for the full list of configuration keys.

## How nodes run

The manager creates one Pod and one Service per node. The Service selector pins to a single pod by `quack-node-id` so traffic never fans out across multiple pods.

Every pod receives the following labels:

| Label | Purpose |
|-------|---------|
| `managed-by` | Matches the `podLabel` value (default `quack-on-demand`); scopes discovery to manager-owned pods. |
| `quack-tenant` | Tenant identifier for the pool this node belongs to. |
| `quack-tenant-db` | Tenant-database identifier. |
| `quack-pool` | Pool name. |
| `quack-role` | Node role: `WriteOnly`, `ReadOnly`, or `Dual`. |
| `quack-node-id` | Unique node identifier; used as the pod name and the Service name. |
| `quack-max-concurrent` | Maximum concurrent queries this node accepts. |

Each pod runs `qod-node`, QoD's own executable on the official DuckDB library: the node image (`docker/quack-node`) ships it with its `libduckdb` under `/opt/qod-node` and carries no DuckDB CLI. The image must match the manager's release: nodes speak node protocol 6 with session handle v4, the image build fails on a binary of another protocol, and a pod running an earlier image refuses every handle, the health probe's included, so it stays unhealthy and is never routed to. After upgrading the manager, pull this release's node image and restart every node.

## Node secrets volume

No secret reaches a node pod as an environment variable or a `secretKeyRef`: a node user with SQL could read its own process environment back. Every Secret below is delivered as files of one read-only projected volume, `qod-node-secrets` (mode 0400, mounted at `/var/run/qod-secrets`, the pod's `QOD_SECRETS_DIR`), and kubelet will not start a pod whose volume references a missing Secret, so the manager creates them all before the pod.

- **Per-pod token Secret** `qod-token-${nodeId}`: the bearer the manager presents on calls to that pod, the node's authorization key `QOD_NODE_AUTHZ_KEY` (see [Node keys and verdict calls](#node-keys-and-verdict-calls)) and a fresh init nonce on every write, `QOD_INIT_NONCE`. The node's id is not a secret: it reaches the pod as the plain environment variable `QOD_NODE_ID`. On manager restart, the `discoverExisting` pass lists all pods matching the `podLabel`, reconstructs the in-memory node registry from their labels and reads each token Secret back, so adopted pods keep serving without a forced pool respawn. The token Secret is deleted alongside the pod on stop.
- **Per-pool init Secret** `qod-fedsql--${tenant}--${tenantDb}--${pool}` (see [Per-pool Secret names](#per-pool-secret-names)): the pool's resolved federation SQL and the database's and pool's own `initSql`, each under a key that records whether a superuser or a tenant admin wrote it, so a pod started for a trusted text never reads a later untrusted one as trusted. Rotation is "update the Secret, restart the pods".
- **Per-pool node credentials Secret** `qod-nodeenv--${tenant}--${tenantDb}--${pool}` (see [Per-pool Secret names](#per-pool-secret-names)): the sensitive `metastore` values, the control-plane password and the `encryptionKey` of an encrypted DuckDB file database (see [Encryption at rest](encryption.md)), plus the manager's own object-store credentials below. The control-plane password travels this way deliberately, not only the encryption key: it opens the catalog holding an encrypted DuckLake database's per-file keys, so protecting one without the other would achieve nothing.
- **Per-pod object-store Secret** `qod-store-${nodeId}`, when the database carries its own `objectStore` settings.

### Per-pool Secret names

A per-pool Secret's name writes the tenant, database and pool names as a node id does: lowercase, with `_` written `-` (tenant `acme`, database `acme_sales`, pool `bi` give `qod-fedsql--acme--acme-sales--bi`). When the pool's first node id is not of that plain form `quack--<tenant>--<db>--<pool>--1` (it is longer than 63 characters, or a name holds something a new create would refuse, as a branch's pool does), the Secret is named after that id instead, without its trailing `-1`: `qod-fedsql--<id>` and `qod-nodeenv--<id>`, `<id>` ending in a 16-character hash.

The per-pool Secrets are garbage-collected when the last pod of the pool stops. The mounted files stay readable inside the pod by a principal with unrestricted SQL (a superuser), so give `postgres.user` a dedicated non-superuser role (the chart requires it and has no default).

## Node keys and verdict calls

Before every statement it sends a node, the manager installs a session handle naming the principal, signed with that node's own key; the node refuses any statement on a connection with no current principal, and judges every statement of a user who is not a superuser on the plan DuckDB bound, asking the replica that minted the handle for a verdict. Two consequences for a Kubernetes deployment:

- **Node keys.** Each node's key derives from one node-key secret: `QOD_NODE_KEY_SECRET` (at least 32 characters, else boot refuses) when set, else a value the first boot generates and stores in the control-plane database (`qodstate_node_authz`), shared by every replica. Under HA set it the same on every replica, or leave it unset on all. Changing it, or deleting the stored row, means restarting every node. Unless it is set, whoever can read the control-plane database (backups, dumps, read replicas) can mint a handle for any principal: protect that database accordingly, or pin `QOD_NODE_KEY_SECRET` from an external secret store.
- **Nodes call the manager back.** Each handle carries the URL of the replica that minted it (`QOD_INTERNAL_URL`), which defaults to `http://<QOD_POD_IP>:20901`: the manager's verdict listener, on the REST port plus one (`QOD_INTERNAL_PORT`). An explicit `QOD_INTERNAL_URL` naming the REST port is refused at boot. The Helm chart sets `QOD_POD_IP` from the downward API (`status.podIP`) and `QOD_INTERNAL_PORT` to `20901`, and refuses `env.QOD_POD_IP`, `env.QOD_INTERNAL_PORT` and, at any replica count, `env.QOD_INTERNAL_URL`, since each replica names itself through its pod IP and one shared URL would send every verdict call to a single replica. A hand-written manifest must set `QOD_POD_IP` from `status.podIP`, or `QOD_INTERNAL_URL`: the manager refuses to boot on Kubernetes with a loopback decide URL. Boot prints `node decide URL: <url>`. With `networkPolicy.enabled`, the chart's policies let node pods reach the manager pods on TCP 20901 whatever `networkPolicy.ingressFrom` says, in the release namespace only.

## Object-store credentials

The manager forwards object-store credentials from its own environment into every spawned node pod, as files of the node credentials Secret above. They sign only each database's own data path: the node's S3 secret is scoped to that path (and its branches), so a read of any other bucket finds no secret. Users who load their own files register S3 keys of their own (`qod profile s3 add`), and superusers do the same or create a scoped secret.

The following variables are forwarded when present on the manager pod:

**S3-compatible (AWS S3, MinIO, SeaweedFS, R2, etc.)**

| Variable | Purpose |
|----------|---------|
| `QOD_S3_ENDPOINT` | S3 endpoint URL. |
| `QOD_S3_ACCESS_KEY_ID` | Access key. |
| `QOD_S3_SECRET_ACCESS_KEY` | Secret key. |
| `QOD_S3_REGION` | Region name. |
| `QOD_S3_URL_STYLE` | `path` or `vhost`. |
| `QOD_S3_USE_SSL` | `true` or `false`. |

**Azure Blob Storage**

| Variable | Purpose |
|----------|---------|
| `QOD_AZURE_CONNECTION_STRING` | Azure Storage connection string. |

**Google Cloud Storage**

| Variable | Purpose |
|----------|---------|
| `QOD_GCS_KEY_ID` | GCS HMAC key ID. |
| `QOD_GCS_SECRET` | GCS HMAC secret. |

Variables that are already set explicitly in `defaultMetastore` (via pool or global configuration) are not overridden by forwarding.

## Helm chart

A Helm chart is provided at `charts/quack-on-demand/`. It deploys the manager pod, three Services (REST/UI on port 20900, FlightSQL on port 31338, and the native Quack front door on port 9494 when `quack.enabled` is true), and the RBAC Role + RoleBinding that lets the manager call the Kubernetes API to create, watch, and delete node pods and services within its own namespace.

Top-level keys in `values.yaml`:

| Key | Description |
|-----|-------------|
| `image` | Manager container image repository, tag, and pull policy. |
| `replicaCount` | Number of manager replicas; above `1` turns on HA (active-active replicas with a Postgres advisory-lock leader). |
| `nameOverride` / `fullnameOverride` | Override rendered resource names. |
| `serviceAccount` | Service account creation and annotations for the manager pod. |
| `rbac` | Controls creation of the Role and RoleBinding for Kubernetes API access. |
| `podAnnotations` / `podLabels` | Extra annotations and labels on the manager pod. |
| `podSecurityContext` / `securityContext` | Pod- and container-level security contexts. |
| `resources` | CPU and memory requests/limits for the manager container. Node pods are sized per pool via `pool/setResources`; see [Pools and cohorts](/qod/operating/pools-cohorts). |
| `nodeSelector` / `tolerations` / `affinity` | Manager pod scheduling constraints. |
| `priorityClassName` | Priority class for the manager pod. |
| `drainTimeoutSec` | Seconds the manager waits for in-flight statements before shutting down (default 60); the pod's `terminationGracePeriodSeconds` is derived as this plus 15. |
| `service` | Services for the REST/UI listener (`rest`), the FlightSQL edge (`flightsql`) and the native Quack front door (`quack`, port 9494), each with `type`, `port`, and `annotations`. |
| `quack` | The native Quack front door DuckDB clients `ATTACH` to: `enabled` (default `true`) and `tls.enabled` (default `false`; the DuckDB client only speaks plain HTTP to loopback hosts, so enable TLS or front the port with an Ingress before exposing it). With `replicaCount > 1` the balancer in front must be session-sticky. See [DuckDB (native Quack)](/qod/connecting/duckdb). |
| `ingress` | Ingress for the REST/UI; FlightSQL (gRPC) is not covered here. |
| `probes` | Liveness and readiness probe tuning. |
| `serviceMonitor` | Prometheus Operator ServiceMonitor toggle. |
| `pdb` | PodDisruptionBudget (only useful when `replicaCount > 1`). |
| `networkPolicy` | Opt-in NetworkPolicies for the manager and node pods; node pods always reach the manager's verdict listener on 20901 for their verdict calls. |
| `postgres` | External Postgres connection details and secret references. `postgres.user` is required and has no default: use a non-superuser role with `CREATEDB`. |
| `quackNode` | Image for the Quack node pods the manager spawns; empty resolves to `starlakeai/quack-on-demand-node:<appVersion>`, the node image released with the manager. |
| `storage` | `dataPath` for the DuckLake catalog parquet files. |
| `s3` | S3-compatible object-store credentials forwarded to node pods, with inline or existing-Secret options. |
| `admin` | Admin credentials seeded on first boot only. `admin.password` or `admin.existingSecret` is required, since nobody could log in without an admin. There is no static API key: the chart fails on an `apiKey` value, and automation uses personal access tokens (`qod auth pat create`). |
| `sessionJwtSecret` / `existingSessionJwtSecret` | Optional session signing key at any replica count. Left empty, the first manager generates one and stores it in the control-plane database, which every restart and replica reads. |
| `flightsql` | `flightsql.tls.enabled` (default `true`) turns FlightSQL TLS on, with a self-signed certificate generated at boot. The chart mounts no certificate of its own: to serve a CA-signed one, mount it with `extraVolumes` / `extraVolumeMounts` and point `env.PROXY_TLS_CERT_CHAIN` and `env.PROXY_TLS_PRIVATE_KEY` at the files (see [TLS](./tls.md#use-a-ca-signed-certificate)). |
| `auth` | OIDC provider configuration (Keycloak off by default). |
| `metrics` | Metrics sink selection (`prometheus`, `aws`, `azure`, `gcp`, or `none`). |
| `loadTpc` | `enabled: true` imports the bundled demo manifest (acme and globex tenants) at startup. |
| `env` | Arbitrary extra environment variables passed to the manager pod, for knobs the chart does not model (for example `QOD_NODE_ALLOW_COMMUNITY_EXTENSIONS`, `QOD_TENANT_FILES_ROOT`, `QOD_NODE_KEY_SECRET`). |
| `extraVolumes` / `extraVolumeMounts` | Additional volumes and mounts (for cert secrets, custom config, etc.). |
| `imagePullSecrets` | Image pull secrets for private registries. |

## Node placement

Per-pool node placement using cohorts (nodeSelector and tolerations) is supported on the Kubernetes backend and is documented in the Pools guide.

## Upgrading

Pods created by an earlier manager are not migrated in place, and a 0.11.0 manager never routes to them. After upgrading, pull this release's node image and restart every node, for example by scaling each pool down and back up. Under HA, upgrade every replica together (scale to one replica, or use a `Recreate` rollout): the 0.11.0 schema migration drops a column the previous release reads. See [Upgrading to 0.11.0](./upgrading.md).

## Secure in production

- [ ] Turn on `networkPolicy.enabled=true` and set real peers and CIDRs in `networkPolicy.ingressFrom`, `networkPolicy.postgres.cidr` and `networkPolicy.objectStore.cidrs` (empty means anywhere). Left off, any pod in the cluster reaches the verdict listener on port 20901 and can hold its connection slots, which stops authorization for every tenant.
- [ ] Set `postgres.user` to a non-superuser role with `CREATEDB` and its password through `postgres.existingSecret`, not the inline `postgres.password`.
- [ ] Take every other credential from an existing Secret too: `admin.existingSecret`, `s3.existingSecret` (the inline `s3.accessKey` / `s3.secretKey` default to demo values) and, when you pin the session secret, `existingSessionJwtSecret`.
- [ ] When control-plane backups are less trusted than the manager, pin `QOD_NODE_KEY_SECRET` (at least 32 characters) under `env` and the session secret above: unset, both are generated and stored in the control-plane database. The chart writes `env` values into the Deployment itself, so limit who can read it.
- [ ] Keep `flightsql.tls.enabled=true` and serve a CA-signed certificate: mount it with `extraVolumes` / `extraVolumeMounts` and point `env.PROXY_TLS_CERT_CHAIN` and `env.PROXY_TLS_PRIVATE_KEY` at the files (see [TLS](./tls.md#use-a-ca-signed-certificate)).
- [ ] Set `quack.tls.enabled=true` before exposing `service.quack` beyond the cluster, or `quack.enabled=false` when no DuckDB client attaches.
- [ ] Expose the REST/UI only through `ingress` with `ingress.tls` (the REST port speaks plain HTTP), and set `env.QOD_SESSION_COOKIE_SECURE=true` if the ingress does not send `X-Forwarded-Proto`.
- [ ] Keep `loadTpc.enabled=false`: the demo manifest creates users whose passwords are published in it.

See [Security hardening](./hardening.md#network-policy-kubernetes-opt-in) for what the network policies allow and the pod security context nodes get.
