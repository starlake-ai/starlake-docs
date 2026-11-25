---
id: deploy-cloud-gcp
title: "Google Cloud: single node and fleet with Terraform"
sidebar_label: Google Cloud
description: "Deploy quack-on-demand on Google Cloud with Terraform: one VM with Cloud SQL and a GCS bucket, or a fleet of VMs with active-active managers behind a passthrough load balancer."
keywords: ["google cloud", "gcp", "terraform", "compute engine", "cloud sql", "gcs", "iap", "duckdb deployment", "no kubernetes", "fleet"]
---

Audience: platform engineer deploying quack-on-demand (QoD) into a Google Cloud project.
Scenario: one VM for evaluation or a small team, or a fleet of VMs with at least two managers for high availability, both built with one `terraform apply`.

The Terraform lives in the [`starlake-ai/qod-deployment`](https://github.com/starlake-ai/qod-deployment/tree/main/terraform/gcp) repository, folder `terraform/gcp/`. It has two stacks:

| Stack | Folder | What you get |
|---|---|---|
| Single node | `terraform/gcp/single-node` | One Compute Engine VM running the manager and its nodes (local runtime) |
| Fleet | `terraform/gcp/fleet` | `worker_count` VMs, each running a fleet worker, with managers on the first `manager_count` of them, behind a passthrough Network Load Balancer |

Both run the pinned `starlakeai/quack-on-demand` Docker image under systemd, on the host network. There is no Kubernetes. Both share the modules in `terraform/gcp/modules/` (network, postgres, storage, instance, disk, fleet-vm, fleet-lb, fleet-firewall).

## Architecture

### Single node

The default setup is `ducklake_storage = "s3"`, `postgres_mode = "managed"`, `network_mode = "public"`:

```diagram
title: QoD on a single Google Cloud VM, with Cloud SQL and a GCS bucket
zones:
  project: {label: Google Cloud project}
  vpc: {label: VPC qod-vpc, detail: subnet 10.42.0.0/24, in: project}
nodes:
  clients: {label: SQL clients, kind: client, detail: flightsql_allowed_cidrs}
  operator: {label: Operator, kind: person, detail: operator_cidr}
  vm: {label: qod-manager VM, kind: server, accent: true, in: vpc, detail: ["e2-standard-4, Ubuntu 24.04", "static external IP, no service account", "quack-on-demand.service (Docker)", ":31338 FlightSQL, TLS", ":20900 REST and UI, closed by default"]}
  sql: {label: Cloud SQL for PostgreSQL 16, kind: database, in: project, detail: ["private IP only, TLS required", control plane and DuckLake catalogs]}
  gcs: {label: GCS bucket, kind: bucket, in: project, detail: [qod-ducklake-xxxx, S3-compatible XML API, HMAC key of a bucket-scoped account]}
edges:
  - "clients -> vm: 31338"
  - "operator -> vm: 22 SSH, tunnel to 20900"
  - "vm -> sql: 5432 Private Service Access"
  - "vm -> gcs: HTTPS storage.googleapis.com"
```

In this setup the VM holds no durable state: the catalog is in Cloud SQL and the data is in the bucket. Only scratch (DuckDB spill) lives on the VM.

Three variables change the shape of the stack. Defaults come first:

| Variable | Value | What it changes on Google Cloud |
|---|---|---|
| `ducklake_storage` | `s3` (default) | Creates a GCS bucket `<name_prefix>-ducklake-<random>` (uniform bucket-level access, public access prevention enforced, not `force_destroy`), a service account `<name_prefix>-ducklake` with `roles/storage.objectAdmin` on that bucket only, and an HMAC key for it. QoD reaches the bucket through `https://storage.googleapis.com` with that key. Default data path: `gs://<bucket>/qod`. |
| | `local` | No bucket. Creates a persistent disk `<name_prefix>-data` (`data_volume_type`, default `pd-balanced`, `data_volume_size_gb`, default 100), attached as device `qod-data` and mounted at `/srv/qod-data` (ext4). DuckLake data goes under `/srv/qod-data/ducklake`. |
| `postgres_mode` | `managed` (default) | Creates Cloud SQL for PostgreSQL 16 (Enterprise edition, zonal, `db_tier` default `db-custom-1-3840`, `db_disk_size_gb` default 10 with autoresize, automated backups on), private IP only through Private Service Access, `ssl_mode = ENCRYPTED_ONLY`. A `qod` database and a `qod` user are created through the API. |
| | `local` | No Cloud SQL. A `postgres:16.16` container (`local_postgres_image`) runs as the `qod-postgres` systemd unit, listens on 127.0.0.1:5432 only, and keeps its data in `/srv/qod-data/postgres` on the persistent disk. |
| `network_mode` | `public` (default) | The VM gets a static external IP (`<name_prefix>-manager`). |
| | `private` | No external IP. A Cloud Router and Cloud NAT give the VM egress. You reach it through IAP, a VPN or a peered network. |

Either local mode creates the persistent disk. It is a separate resource from the VM, so it survives a VM replacement. It is destroyed by `terraform destroy`.

What the stack creates:

| Resource | Default | Notes |
|---|---|---|
| Project services | Compute; plus Cloud SQL Admin and Service Networking for `managed`; plus Storage and IAM for `s3` | Left enabled on destroy |
| VPC and subnet | `<name_prefix>-vpc`, `<name_prefix>-subnet`, `subnet_cidr = "10.42.0.0/24"` | Custom VPC, no auto subnets, Private Google Access on |
| Firewall rules | `<name_prefix>-ssh`, `<name_prefix>-flightsql`, `<name_prefix>-rest-ui` | The last two exist only when enabled (see [Network and security](#network-and-security)) |
| VM | `<name_prefix>-manager`, `machine_type = "e2-standard-4"`, image `ubuntu-os-cloud/ubuntu-2404-lts-amd64` | 30 GB `pd-balanced` boot disk, Shielded VM (secure boot, vTPM, integrity monitoring), no service account |
| Local SSDs | `local_ssd_count = 0` | 375 GB NVMe each, RAID0 when several, mounted at `/mnt/nvme` for DuckDB spill. e2 types cannot carry local SSDs: pick an n2, n2d or c3 type |
| Cloud SQL | `<name_prefix>-pg-<random>`, `db-custom-1-3840` | `postgres_mode = "managed"` only |
| GCS bucket, service account, HMAC key | | `ducklake_storage = "s3"` only |
| Persistent disk | `<name_prefix>-data`, 100 GB `pd-balanced` | Either local mode |

`name_prefix` defaults to `qod`. The VM runs QoD `qod_version = "0.14.2"`. DuckDB gets `duckdb_memory_fraction = 0.6` of the VM's RAM as `memory_limit`; the JVM manager gets most of the rest.

### Fleet

```diagram
title: QoD fleet on Google Cloud, VMs behind a passthrough load balancer
zones:
  subnet: {label: Subnet, detail: "10.42.0.0/24, no external IPs"}
nodes:
  clients: {label: SQL clients, kind: client, detail: flightsql_allowed_cidrs}
  operator: {label: Operator, kind: person, detail: IAP 35.235.240.0/20}
  lb: {label: Passthrough Network Load Balancer, kind: balancer, detail: ["external IP (public) or internal .5 (private)", ":31338 FlightSQL, :9494 DuckDB", ":20900 when rest_ui_public", "health check GET /health on :20900"]}
  vm0: {label: VM 0, kind: server, accent: true, in: subnet, detail: ["qod-w0, 10.42.0.10", qod-manager, "qod-worker, node :21900", "qod-haproxy 127.0.0.1:20990"]}
  vm1: {label: VM 1, kind: server, accent: true, in: subnet, detail: ["qod-w1, 10.42.0.11", qod-manager, "qod-worker, node :21900", "qod-haproxy 127.0.0.1:20990"]}
  vm2: {label: VM 2 and up, kind: server, accent: true, in: subnet, detail: ["qod-w2, 10.42.0.12", "qod-worker, node :21900", "qod-haproxy 127.0.0.1:20990"]}
  nat: {label: Cloud NAT, kind: gateway, detail: egress}
  sql: {label: Cloud SQL for PostgreSQL 16, kind: database, detail: "private IP, TLS required"}
  gcs: {label: GCS bucket, kind: bucket, detail: "HMAC key, bucket-scoped"}
edges:
  - clients -> lb
  - "lb -> vm0: client ports"
  - "lb -> vm1: client ports"
  - "operator -> vm0: 22 IAP"
  - "vm2 -> vm0: 20900 heartbeats"
  - vm2 -> vm1
  - vm0 -> sql
  - vm1 -> sql
  - vm0 -> gcs
  - vm1 -> gcs
  - "vm2 -.-> nat: egress, every VM"
```

- **qod-manager** runs on VMs `0 .. manager_count-1` with `QOD_RUNTIME_TYPE=fleet` and `QOD_HA_ENABLED=true`. Every replica serves clients. The leader, elected through PostgreSQL, runs reconciliation and maintenance. Each replica advertises its own `QOD_INTERNAL_URL` (`http://<its IP>:20901`) for node verdict calls. See [High availability](./deploy-fleet.md#high-availability).
- **qod-worker** runs on every VM: `qod fleet join`, one fleet server named `<name_prefix>-w<i>` and one quack node on `<VM IP>:21900`.
- **qod-haproxy** runs on every VM: a local TCP proxy on `127.0.0.1:20990` over every manager's REST port 20900, health-checked on `/health`. The worker's `QOD_MANAGER_URL` is this proxy, so heartbeats keep reaching a live manager when one is down.
- Only the manager VMs sit behind the load balancer (an unmanaged instance group in one zone; every fleet VM shares that zone).

Defaults:

| Variable | Default | Rule |
|---|---|---|
| `worker_count` | `3` | 2 to 200. Every VM runs a worker. |
| `manager_count` | `2` | At least 2, at most `worker_count`. Managers run on the first VMs. |
| `machine_type` | `e2-standard-4` | Every VM (4 vCPU, 16 GB). |
| `local_ssd_count` | `0` | Per VM, for DuckDB spill. |
| `db_tier` | `db-custom-2-7680` | 2 vCPU, 7.5 GB. |
| `db_max_connections` | `400` | At least 200, or `null` for the tier default. Every node holds its own catalog connections. |
| `duckdb_memory_fraction` | `0.5` | Lower than on a single node: on manager VMs the node shares RAM with the JVM. |
| `haproxy_image` | `haproxy:3.0.31` | Exact patch versions only. |
| `network_mode` | `public` | `public`: the load balancer has a regional external IP. `private`: internal load balancer at host 5 of the subnet. The VMs never have external IPs and always use Cloud NAT. |

The fleet always uses Cloud SQL and a GCS bucket: it has no `ducklake_storage` or `postgres_mode` variable and no data disk. The VMs hold no durable state.

**Credentials on the VMs.** Only manager VMs receive the PostgreSQL password, the HMAC key, the admin password and the TLS material. A worker-only VM holds the join token (`QOD_FLEET_JOIN_TOKEN` in `/etc/qod/worker.env`) and nothing else: the manager sends the PostgreSQL and storage settings and keys in each assignment (see [Object-store keys come from the manager](./deploy-fleet.md#object-store-keys-come-from-the-manager)). Joins are auto-approved from the fleet subnet only (`QOD_FLEET_AUTO_APPROVE=<subnet_cidr>`).

**Deterministic addresses.** VM `i` gets the fixed internal IP of host `10+i` of `subnet_cidr` (10.42.0.10, 10.42.0.11, ...), managers first. Cloud-init can therefore name every manager before any VM exists. In private mode the internal load balancer takes host 5 (10.42.0.5).

### Network and security

Both stacks create a custom VPC, which denies all ingress by default. The firewall rules below are the only way in. They target the network tag `qod-manager` (single node) or `qod-fleet` (fleet).

| Port | Service | Single node | Fleet |
|---|---|---|---|
| 31338 | FlightSQL, TLS | `flightsql_allowed_cidrs` (rule `<name_prefix>-flightsql`). No rule at all while the list is empty. | Forwarded by the load balancer to the managers. Rule `<name_prefix>-fleet-clients` admits `flightsql_allowed_cidrs`, plus the fleet subnet and Google's health-check ranges. |
| 9494 | DuckDB `quack:` front door | Not opened. | Same as 31338. |
| 20900 | REST API and admin UI | Closed. With `rest_ui_public = true`, open to `operator_cidr` (rule `<name_prefix>-rest-ui`). | Fleet subnet (worker heartbeats), Google's health-check ranges (load balancer health check). Forwarded by the load balancer and open to `operator_cidr` only when `rest_ui_public = true`. |
| 22 | SSH | `operator_cidr` | IAP range `35.235.240.0/20` only. |
| 20901 | Manager internal listener (HA, node verdicts) | Not used. | Fleet subnet only. |
| 21900 | Fleet node port, dialed by the managers | Not used. | Fleet subnet only. |
| 20990 | Local heartbeat proxy | Not used. | 127.0.0.1 only. |
| 5432 | PostgreSQL | Cloud SQL private IP over Private Service Access, TLS required; or the local container on 127.0.0.1. | Cloud SQL private IP, TLS required. |

Google's health-check ranges are `35.191.0.0/16`, `130.211.0.0/22`, `209.85.152.0/22` and `209.85.204.0/22` (rule `<name_prefix>-fleet-health-checks`, ports 20900, 31338 and 9494).

**Where source filtering happens.** The fleet load balancer is a passthrough (L4) Network Load Balancer: the client connection reaches a manager with its source address unchanged. Filtering therefore happens in the VPC firewall rules on the VMs, not on the load balancer.

**SSH path.** On a public single node, SSH to the external IP from `operator_cidr`. On a private single node, set `operator_cidr = "35.235.240.0/20"` and SSH through IAP (`gcloud compute ssh ... --tunnel-through-iap`), or reach the internal IP from a VPN or peered network. On the fleet, SSH always goes through IAP. The SSH key is set in instance metadata for the `ubuntu` user; project-wide SSH keys are blocked and OS Login is off.

**Secrets.** Terraform never outputs a secret. On the host they live in root-only (mode 600) env files that Docker hands to the containers:

| File | Where | Holds |
|---|---|---|
| `/etc/quack-on-demand.env` | Single node; every manager VM | `QOD_ADMIN_PASSWORD`, `QOD_PG_PASSWORD`, `QOD_S3_ACCESS_KEY_ID` and `QOD_S3_SECRET_ACCESS_KEY` (HMAC key), `QOD_SESSION_JWT_SECRET`, `QOD_FLEET_JOIN_TOKEN` (fleet) |
| `/etc/qod-postgres.env` | Single node with `postgres_mode = "local"` | Local PostgreSQL superuser password |
| `/etc/qod/worker.env` | Every fleet VM | `QOD_FLEET_JOIN_TOKEN` |

The env file also carries a generated `QOD_API_KEY`. QoD 0.14.2 no longer accepts a static API key (it logs a warning at boot), so do not use it to sign in. Sign in as the admin user with `admin_password` (see [First use](#first-use)).

The same secrets travel in the instance's `user-data` metadata. Anyone who can read the instance in the project (for example with `roles/viewer`, through the console or `gcloud compute instances describe`) can see them. Run the stack in a project whose readers you trust with these secrets.

**Metadata lockdown.** On the VM, cloud-init installs an nftables rule that drops TCP port 80 to `169.254.169.254` for every process that is not root. Container processes run as non-root uids on the host network, so the rule covers them too. DNS (53) and NTP (123) on the same address stay open, because non-root daemons (systemd-resolved, chrony) need them. The VMs carry no Google service account, so there is no access token to steal from the metadata server either.

**Docker.** The daemon runs with `"bridge": "none"`, `"iptables": false` and logs to journald. Every container uses the host network, so Docker publishes nothing that could bypass the host filter.

For the node-side controls that apply on every deployment, see [Hardening](./hardening.md). For TLS certificates, see [TLS](./tls.md).

## How to

### Prerequisites

- Terraform 1.7 or later (`required_version = ">= 1.7"`, provider `hashicorp/google ~> 6.0`).
- The `gcloud` CLI, for SSH through IAP and for reading outputs from the VMs. The fleet's wait loop also uses `jq`.
- The `qod` CLI on your workstation, at the server's version: `uv tool install qod==0.14.2`.
- A Google Cloud project and an identity allowed to enable services and to create Compute Engine, Cloud SQL, Storage and IAM resources in it.
- Credentials from the environment, never from tfvars: Application Default Credentials (`gcloud auth application-default login`), or a key file named by `GOOGLE_APPLICATION_CREDENTIALS`.
- To SSH through IAP (private single node, every fleet), your account must be allowed to use IAP TCP forwarding in the project.

The stacks enable the APIs they need themselves (Compute; Cloud SQL Admin and Service Networking; Storage and IAM) and leave them enabled on destroy. Check your regional CPU quota before a fleet: the default is 3 x e2-standard-4, 12 vCPUs.

### Deploy a single node

1. Get the code and go to the stack:

   ```bash
   git clone https://github.com/starlake-ai/qod-deployment.git
   cd qod-deployment/terraform/gcp/single-node
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars`. The required variables have no default:

   ```hcl
   project                 = "my-project-id"
   operator_cidr           = "203.0.113.4/32"     # your IP; 35.235.240.0/20 for IAP in private mode
   flightsql_allowed_cidrs = ["203.0.113.4/32"]   # empty = nobody reaches FlightSQL
   ssh_public_key          = "ssh-ed25519 AAAA... you@host"
   admin_password          = "change-me-to-a-real-passphrase"   # >= 12 chars, never "admin"

   # region = "europe-west1"   # zone defaults to "<region>-b"

   # Setup options (defaults shown)
   # ducklake_storage    = "s3"       # or "local": persistent disk at /srv/qod-data
   # postgres_mode       = "managed"  # or "local": PostgreSQL container on 127.0.0.1
   # network_mode        = "public"   # or "private": no external IP, Cloud NAT egress
   # data_volume_size_gb = 100        # created when either local mode is used

   # rest_ui_public = false           # true opens 20900 to operator_cidr
   ```

   For production, set `tls_mode = "provided"` with `tls_cert_pem` and `tls_key_pem`; the default `self-signed` makes clients skip certificate verification.

3. Apply:

   ```bash
   terraform init
   terraform apply
   ```

   With `postgres_mode = "managed"`, Cloud SQL is the longest part of the apply.

4. Wait for cloud-init and check the service:

   ```bash
   IP=$(terraform output -raw manager_public_ip)     # private mode: manager_private_ip
   ssh ubuntu@"$IP" 'sudo cloud-init status --wait && systemctl is-active quack-on-demand'
   ssh ubuntu@"$IP" 'curl -s http://127.0.0.1:20900/health; curl -s http://127.0.0.1:20900/ready'
   ```

   In private mode, SSH through IAP instead:

   ```bash
   gcloud compute ssh ubuntu@$(terraform output -raw manager_instance) --tunnel-through-iap
   ```

5. Get the client endpoints:

   ```bash
   terraform output -raw flightsql_endpoint   # <ip>:31338, TLS
   terraform output -raw rest_ui_tunnel       # ssh -L 20900:localhost:20900 ubuntu@<ip>
   ```

6. Continue with [First use](#first-use).

With `ducklake_storage = "local"` there is no bucket: DuckLake data goes under `/srv/qod-data/ducklake/<database>`.

### Deploy a fleet

1. Go to the stack and copy the example:

   ```bash
   cd qod-deployment/terraform/gcp/fleet
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars`:

   ```hcl
   project                 = "my-project-id"
   operator_cidr           = "203.0.113.4/32"     # REST/UI through the LB when rest_ui_public; SSH always uses IAP
   flightsql_allowed_cidrs = ["203.0.113.4/32"]   # who reaches 31338 and 9494 through the LB
   ssh_public_key          = "ssh-ed25519 AAAA... you@host"
   admin_password          = "change-me-to-a-real-passphrase"   # the same on every manager

   # worker_count  = 3          # fleet VMs; each runs a worker
   # manager_count = 2          # at least 2, at most worker_count
   # network_mode  = "public"   # or "private": internal load balancer
   # rest_ui_public = false     # true forwards 20900 on the LB, open to operator_cidr
   ```

   With `tls_mode = "provided"` the certificate should name the load balancer address.

3. Apply:

   ```bash
   terraform init
   terraform apply
   ```

4. Wait for cloud-init on every VM, through IAP (use the zone you deployed to, `<region>-b` by default):

   ```bash
   for vm in $(terraform output -json vm_names | jq -r '.[]'); do
     gcloud compute ssh "ubuntu@$vm" --zone europe-west1-b --tunnel-through-iap -- 'sudo cloud-init status --wait'
   done
   ```

5. Get the client endpoints:

   ```bash
   terraform output -raw lb_address
   terraform output -raw flightsql_endpoint   # <lb>:31338, TLS
   terraform output -raw duckdb_endpoint      # quack:<lb>:9494, for ATTACH 'quack:<lb>:9494'
   terraform output -raw ssh_manager0         # gcloud compute ssh ... --tunnel-through-iap
   ```

6. Check that every VM joined. On manager 0:

   ```bash
   $(terraform output -raw ssh_manager0)
   sudo docker exec -it qod-manager qod login --url http://127.0.0.1:20900   # user admin, password = admin_password
   sudo docker exec -it qod-manager qod fleet servers
   ```

   Every VM should be listed as `<name_prefix>-w<i>`, `reachable` and `approved`. See [Operate the fleet](./deploy-fleet.md#operate-the-fleet) for the fields.

7. Continue with [First use](#first-use), run against a manager.

In `network_mode = "private"` the load balancer address is internal: reach it from the VPC, a VPN or a peered network.

### First use

A fresh install has no tenant. FlightSQL refuses every query with `missing tenant scope ... 'tenant' header required` until a tenant, a database and a pool exist. Create them from inside the manager container, which ships the `qod` CLI at the server's version:

```bash
# on the VM (single node) or on a manager VM (fleet)
sudo docker exec -it qod-manager qod login --url http://127.0.0.1:20900          # user admin, password = admin_password
sudo docker exec -it qod-manager qod tenant create acme --display-name Acme
sudo docker exec -it qod-manager qod database create --tenant acme --name lake   # -> database acme_lake
sudo docker exec -it qod-manager qod pool create --tenant acme --db acme_lake --pool bi --size 1 --dual 1
```

`--display-name` is required on `tenant create` in 0.14.2. Where the database's data lands:

| Storage | Data path |
|---|---|
| `ducklake_storage = "local"` | `/srv/qod-data/ducklake/acme_lake` (no path to name) |
| `ducklake_storage = "s3"`, and the fleet | `gs://<bucket>/acme_lake/`, at the bucket root next to the `qod/` prefix of `QOD_DUCKLAKE_DATA_PATH`, not under it (checked on GCS with QoD 0.14.2). |

Then query from your workstation over FlightSQL. `qod login` needs the REST port, and it stores the FlightSQL host it will use for `qod sql`. When the manager does not advertise one, that host is the one in `--url`.

- With `rest_ui_public = true` (single node: the VM's IP; fleet: the load balancer address):

  ```bash
  qod login --url http://<address>:20900
  qod sql --tenant acme --pool bi --superuser "SELECT 42"
  ```

- Without it, tunnel both ports, so `qod sql` reaches FlightSQL on `localhost` as well:

  ```bash
  # single node, public
  ssh -f -N -L 20900:localhost:20900 -L 31338:localhost:31338 ubuntu@"$IP"
  # fleet: $(terraform output -raw ssh_manager0) -- -N -L 20900:localhost:20900 -L 31338:localhost:31338 &
  qod login --url http://localhost:20900
  qod sql --tenant acme --pool bi --superuser "SELECT 42"
  ```

`qod sql` needs the SQL password: it prompts, or reads `QOD_PASSWORD`. The self-signed certificate is not verified by default.

Other clients (JDBC, ADBC, DBeaver, BI tools) connect to `flightsql_endpoint` with the `tenant` and `pool` headers: see [Clients](../connecting/clients.md) and [Authenticating](../connecting/authenticating.md). For automation, create a personal access token (`qod auth pat create`) rather than reusing the admin password. To add tenants and pools, see [Tenants and databases](./tenants-databases.md) and [Pools and cohorts](./pools-cohorts.md).

### Operate

**Logs.** QoD logs go to the journal through Docker's journald driver. QoD itself:

```bash
sudo journalctl CONTAINER_NAME=qod-manager -f
```

The systemd unit (preflight, database wait, image pull):

```bash
sudo journalctl -u quack-on-demand
```

On a single node with `postgres_mode = "local"`, the local PostgreSQL:

```bash
sudo journalctl CONTAINER_NAME=qod-postgres
```

On a fleet VM, the worker and the heartbeat proxy:

```bash
sudo journalctl CONTAINER_NAME=qod-worker
```

```bash
sudo journalctl CONTAINER_NAME=qod-haproxy
```

```bash
sudo journalctl -u qod-worker
```

**Health.** The container image has no curl; use the host's: `curl -s http://127.0.0.1:20900/health` and `curl -s http://127.0.0.1:20900/ready`.

**Upgrade in place** (no rebuild). The units read `QOD_IMAGE` and `QOD_VERSION` from the env file and pull a missing tag once.

- Single node: set `QOD_VERSION=<new>` in `/etc/quack-on-demand.env`, then `sudo systemctl restart quack-on-demand`.
- Fleet, one VM at a time, managers one at a time: set `QOD_VERSION=<new>` in `/etc/qod/worker.env` on every VM and in `/etc/quack-on-demand.env` on manager VMs. Then run `sudo systemctl restart quack-on-demand qod-worker` on a manager VM, and `sudo systemctl restart qod-worker` on a worker-only VM (it has no `quack-on-demand` unit).

Set the same `qod_version` in `terraform.tfvars`. A later rebuild runs whatever tag Terraform renders into cloud-init, and changing `qod_version` there replaces the VM (every VM on a fleet). Read [Upgrading](../upgrading/to-0-11.md) for the release notes.

**Rebuild and replacement.** Google Cloud applies a metadata change to a running VM in place, and cloud-init would not run again. The stacks therefore tie each VM to a hash of its rendered cloud-init script: **any change that alters the script replaces the VM** (for example `qod_version`, `admin_password`, `tls_mode` or the maintenance settings). Run `terraform plan` and read it before every apply.

```bash
# single node
terraform apply -replace=module.instance.google_compute_instance.qod
# fleet, one VM
terraform apply -replace='module.fleet_vm.google_compute_instance.vm[<i>]'
```

On a single node the data disk (local modes) is reattached as is: cloud-init formats it only when it has no filesystem. The static external IP survives, but the VM gets a new SSH host key: run `ssh-keygen -R <ip>` before the next SSH. On a fleet, a replaced VM keeps its fixed internal IP and rejoins on boot.

**Scale the fleet.** Raise `worker_count` and apply: the new VMs join on boot. Lowering it destroys the highest-numbered VMs, and Terraform does not drain them first. Their nodes go away with them, and QoD reassigns their slots after `reassignAfterSec` (600 s by default). To avoid failed statements, drain those servers before the apply and remove them after:

```bash
# example: worker_count 5 -> 4 removes qod-w4
sudo docker exec -it qod-manager qod fleet drain qod-w4
terraform apply
sudo docker exec -it qod-manager qod fleet remove qod-w4
```

Changing `manager_count` re-renders every VM's HAProxy backend list, so **every VM is replaced**. Plan it as a maintenance window.

**Backups.** With Cloud SQL, automated backups are on (`backup_configuration.enabled = true`). The bucket has no versioning set by the stack. In either local mode, nothing backs up the persistent data disk: snapshot it yourself, for example:

```bash
gcloud compute disks snapshot qod-data --zone europe-west1-b
```

### Tear down

1. **Deletion protection.** Cloud SQL has deletion protection on by default (`db_deletion_protection = true`), so `terraform destroy` refuses it. Set `db_deletion_protection = false`, run `terraform apply`, then destroy.
2. **Non-empty bucket.** The bucket is not `force_destroy`. Empty it first, or the destroy stops on it:

   ```bash
   gcloud storage rm -r gs://$(terraform output -raw ducklake_bucket)/**
   ```

3. **Destroy:**

   ```bash
   terraform destroy
   ```

The persistent data disk (local modes) is destroyed with no snapshot: take one first if you need the data. The project services stay enabled. Cloud SQL instance names stay reserved for a week after deletion; the stack adds a random suffix, so a new apply with the same `name_prefix` still works.

### Status

**Single node.** `terraform validate` and `terraform test` (10 runs against mock providers, covering the setup options and the input guards) pass.

One real apply ran on 2026-11-25 with QoD 0.14.2, in `europe-west1`, on `e2-standard-4`, with `ducklake_storage = "local"`, `postgres_mode = "managed"`, `network_mode = "public"` and `rest_ui_public = true`:

- The apply created 22 resources. Cloud-init completed.
- QoD was healthy about 15 seconds after the container started.
- The data disk was mounted at `/srv/qod-data` (ext4).
- The [First use](#first-use) sequence worked from a laptop over FlightSQL. A 1000-row table was written as Parquet under `/srv/qod-data/ducklake/`.
- The metadata server was blocked for non-root users.
- Port 9494 is not opened on the single node.
- The VM was then replaced with `terraform apply -replace=module.instance.google_compute_instance.qod` (1 added, 1 destroyed). Data survival is verified: the new VM came up with the same static IP, cloud-init completed and `/health` answered 200. The same Parquet file was still under `/srv/qod-data/ducklake/smoke_lake/main/smoke/`. The same query over FlightSQL from the laptop returned the same result (1000 rows, sum 999000). The SSH host key changes on a rebuild: clear the old one with `ssh-keygen -R <ip>`.

Not yet run on a real project: `ducklake_storage = "s3"` (including DuckDB's object deletes against GCS's S3-compatible XML API, which maintenance cleanup relies on), `postgres_mode = "local"`, `network_mode = "private"` and IAP access, `tls_mode = "provided"`, and local SSD discovery.

**Fleet.** `terraform validate` and `terraform test` (11 runs against mock providers, covering the topology rules, both network modes, the REST listener and the input guards) pass. No real `terraform apply` has been run. Unverified until one: fleet HA end to end on Google Cloud (heartbeats through the local proxy, node verdict calls between VMs, leader failover behind the passthrough load balancer), the load balancer health check against `/health` on every replica, DuckDB's object deletes against GCS, and local SSD discovery.

Treat the single node as validated for the one setup above, and the fleet as ready for a first real apply, not as a validated production deployment.
