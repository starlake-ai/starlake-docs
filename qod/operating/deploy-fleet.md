---
id: deploy-fleet
title: "Fleet deployment: nodes on your own servers, no Kubernetes"
sidebar_label: Fleet (bare servers)
description: "Run DuckDB nodes across many Linux or macOS servers without Kubernetes: servers join with qod agent, the manager schedules one node per server from a shared fleet."
keywords: ["duckdb cluster", "bare metal", "fleet", "qod agent", "systemd", "launchd", "no kubernetes", "duckdb deployment"]
---

Audience: platform engineer or DBA who has several servers (VMs or physical hosts) but no Kubernetes cluster.
Scenario: one or more managers, a shared PostgreSQL, a shared object store, and a pool of Linux or macOS servers that each run one DuckDB node.

```bash
# Manager (one host, or several under HA)
export QOD_RUNTIME_TYPE=fleet
export QOD_FLEET_JOIN_TOKEN="$(openssl rand -hex 32)"   # keep it: every server needs it
qod start

# Every server that should run a node (Linux or macOS)
export QOD_FLEET_JOIN_TOKEN=<the same token>
qod agent --manager https://mgr.internal:20900 --advertise-host 10.0.3.17
```

The rest of this page explains each line: what the manager needs, how to run the agent as a service, how nodes are scheduled, what happens when a server goes down, and the security rules that come with a shared join token.

## When to choose fleet

QoD has three runtimes. They differ only in where the DuckDB nodes run; tenants, pools, RBAC, routing and every client connection string are identical.

| Runtime | `QOD_RUNTIME_TYPE` | Nodes run | Choose it when |
|---|---|---|---|
| Local | `local` (default) | Child processes of the manager, on the manager host | One server is enough. See [Single-server production deployment](deploy-single-server.md). |
| Fleet | `fleet` | One node per joined server, started by `qod agent` | You have several servers and no Kubernetes, or you want each node on dedicated hardware. |
| Kubernetes | `kubernetes` | One pod per node, created through the Kubernetes API | You already run a cluster. See [Kubernetes deployment](deploy-kubernetes.md). |

A fleet is a set of servers that joined by running `qod agent`. Joining means the server will run a quack node: each server runs **exactly one** node, and the manager decides which pool it serves. Servers are shared by every pool of every tenant; the manager hands a free server to whichever pool needs a node.

## Prerequisites

- **Linux or macOS servers.** `qod agent` is not available on Windows yet.
- **The `qod` CLI on every server** (`pip install qod`, or run it through `uvx qod agent ...`). The agent provisions a `duckdb` binary into its cache on first start; pass `--duckdb-bin /path/to/duckdb` to use one you installed yourself.
- **Shared object storage for every DuckLake data path.** A node can land on any server, so every database's `dataPath` must be an object-store URL (`s3://...`, `gs://...`, `az://...`) reachable from all servers. A local path would only exist on one of them. [Managed storage](managed-storage.md) satisfies this by construction.
- **The metastore PostgreSQL reachable from every server.** Nodes attach their DuckLake catalog directly, so each server must reach the Postgres host and port of every database it may serve.
- **A private network between managers and servers** (VPC, VLAN, WireGuard). The manager talks to nodes over plain HTTP; see [Security](#security).
- **An HTTPS URL for the manager's REST port.** The agent refuses a plain `http://` manager URL, because each assignment it receives carries database credentials. Put a TLS-terminating reverse proxy or load balancer in front of `:20900` (you need one under HA anyway). `--insecure` accepts an `http://` URL; reserve it for tests on a trusted network.

## Configure the manager

Set `QOD_RUNTIME_TYPE=fleet` and a join token. Everything else has a working default.

| Key | Env var | Default | Meaning |
|---|---|---|---|
| `quack-on-demand.runtimeType` | `QOD_RUNTIME_TYPE` | `local` | Set to `fleet`. |
| `quack-on-demand.fleet.joinToken` | `QOD_FLEET_JOIN_TOKEN` | (none) | Shared secret every agent heartbeat carries. Required: the manager refuses to boot in fleet mode without it. |
| `quack-on-demand.fleet.heartbeatSec` | `QOD_FLEET_HEARTBEAT_SEC` | `5` | Agent heartbeat interval. The manager returns it in every reply, so agents follow this one setting. |
| `quack-on-demand.fleet.heartbeatTimeoutSec` | `QOD_FLEET_HEARTBEAT_TIMEOUT_SEC` | `30` | Silence beyond this marks a server `unreachable`. Must be greater than `heartbeatSec`. |
| `quack-on-demand.fleet.reassignAfterSec` | `QOD_FLEET_REASSIGN_AFTER_SEC` | `600` | Silence beyond this marks a server `dead` and moves its node to a free server. `0` moves it as soon as the server is unreachable, `-1` never moves it. Otherwise must be at least `heartbeatTimeoutSec`. |
| `quack-on-demand.fleet.startupTimeoutSec` | `QOD_FLEET_STARTUP_TIMEOUT_SEC` | `120` | How long the manager waits for an agent to report its new node running before giving the server back. |
| `quack-on-demand.fleet.stopTimeoutSec` | `QOD_FLEET_STOP_TIMEOUT_SEC` | `60` | How long the manager waits for an agent to report a node stopped. A stop never fails: an unreachable server stops its node on its next heartbeat. |
| `quack-on-demand.fleet.ephemeral` | `QOD_FLEET_EPHEMERAL` | `fleet` | Where maintenance and branch-merge nodes run: `fleet` claims a server, `local` runs them on the manager host. See [Ephemeral nodes](#ephemeral-nodes). |

Invalid combinations (a timeout not above the heartbeat, an unknown `ephemeral` value) are refused at boot with a message naming the key.

The usual production settings still apply: pin `QOD_API_KEY` and `QOD_SESSION_JWT_SECRET`, point `QOD_PG_*` at your control-plane Postgres, and follow [Hardening](hardening.md). See the [Configuration reference](/qod/reference/configuration) for every key.

## Join a server

On each server, run the agent with the manager URL and the join token. Pass the token through the environment, never with `--join-token`: a command-line argument is visible to every local user in `ps`.

```bash
export QOD_FLEET_JOIN_TOKEN=<the join token>
qod agent --manager https://mgr.internal:20900 --advertise-host 10.0.3.17 --name srv-07
```

The first heartbeat is the join: there is no approval step. The server appears in `qod fleet servers` a few seconds later and becomes eligible for the next node the manager needs to place.

| Flag | Default | Meaning |
|---|---|---|
| `--manager` | env `QOD_MANAGER_URL` | Manager base URL, `https://host:20900`. Required. |
| `--join-token` | env `QOD_FLEET_JOIN_TOKEN` | The fleet join token. Prefer the environment variable. |
| `--name` | the hostname | Server identity. Must be unique in the fleet. |
| `--advertise-host` | first non-loopback IPv4 | Address the manager dials to reach the node. Set it explicitly on hosts with more than one network interface. |
| `--bind-host` | the advertise host | Interface the node listens on. `0.0.0.0` listens on every interface. |
| `--node-port` | `21900` | Port the node listens on. |
| `--duckdb-bin` | provisioned into the qod cache | DuckDB executable to run the node with. |
| `--state-dir` | the qod cache | Where the node pidfile lives. |
| `--insecure` | off | Accept a plain `http://` manager URL. |

**Pick the advertise host deliberately.** On a host with a management interface and a data interface, the default guess can pick the wrong one, silently. The agent logs its choice at start (`advertise host 10.0.3.17 ... override with --advertise-host / --bind-host if this is not the data interface`); check that line, or always pass `--advertise-host`. Because `--bind-host` defaults to the advertise host, the node never listens on the management interface by accident.

The agent restarts its node itself when DuckDB crashes, backing off from 5 seconds to 5 minutes between attempts; the manager only sees the state reports. A node crash is never a scheduling event.

### Run the agent under systemd (Linux)

`/etc/systemd/system/qod-agent.service`:

```ini
[Unit]
Description=quack-on-demand fleet agent
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/qod agent --manager https://mgr.internal:20900 --advertise-host 10.0.3.17 --name %H
Environment=QOD_FLEET_JOIN_TOKEN=<the join token>
Restart=always
KillMode=control-group

[Install]
WantedBy=multi-user.target
```

```bash
sudo chmod 600 /etc/systemd/system/qod-agent.service   # the token is in it
sudo systemctl daemon-reload
sudo systemctl enable --now qod-agent
journalctl -u qod-agent -f
```

`KillMode=control-group` makes `systemctl stop` take the node down with the agent. If the agent itself is killed hard, the next start finds the orphaned node through the pidfile in its state directory and stops it before doing anything else.

### Run the agent under launchd (macOS)

`/Library/LaunchDaemons/ai.starlake.qod-agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ai.starlake.qod-agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/qod</string>
    <string>agent</string>
    <string>--manager</string><string>https://mgr.internal:20900</string>
    <string>--advertise-host</string><string>10.0.3.18</string>
    <string>--name</string><string>mac-01</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>QOD_FLEET_JOIN_TOKEN</key><string>the join token</string>
  </dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
```

```bash
sudo chmod 600 /Library/LaunchDaemons/ai.starlake.qod-agent.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/ai.starlake.qod-agent.plist
```

### What the node inherits from the agent

The node does not inherit the agent's whole environment: the agent holds the join token, and a node runs tenant SQL. It receives only `PATH`, `HOME`, `TMPDIR`, `LANG`, `LC_ALL`, `TZ`, `USER`, `LOGNAME`, `SHELL`, the proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` and their lowercase forms), `DUCKDB_BIN`, `QOD_APP_HOME`, the object-storage settings `QOD_S3_*` and `QOD_AZURE_*`, plus the assignment the manager sends.

Metastore connection settings that a server needs go on the agent's unit and are passed through:

| Variable | Set it when |
|---|---|
| `PG_ADMIN_DB` | The database `CREATE DATABASE` runs from is not `postgres`. |
| `PGSSLMODE`, `PGSSLROOTCERT`, `PGSSLCERT`, `PGSSLKEY` | The metastore Postgres is reached over TLS. |
| `PGCONNECT_TIMEOUT` | The metastore is slow to accept connections. |
| `SSL_CERT_FILE` | A custom CA bundle is needed for outbound TLS. |

Anything else exported on the agent never reaches a node.

## How scheduling works

When a pool needs a node (create, scale up, a respawn), the manager claims one server from the fleet in a single Postgres statement. A server qualifies when it is:

- reachable (heard from within `heartbeatTimeoutSec`),
- not drained,
- not already running a node,
- large enough: its reported RAM is at least the pool's `--memory`, when the pool sets one. A server that reports no capacity always fits.

Servers are claimed oldest-joined first. The claim is atomic, so two managers under HA never hand out the same server. The manager then waits for that server's agent to report the node running (up to `startupTimeoutSec`) before routing to it.

**Pools accept more nodes than there are servers.** `qod pool create --size 3` on a fleet of one server succeeds: one node starts, and the other two slots stay **pending** until servers join. The manager fills pending slots on its reconcile loop, so a new server picks up work within one `reconcileIntervalSec` (30 s by default).

```bash
qod --json pool list | jq '.pools[] | {tenant, pool, nodes: (.nodes | length), pending, pendingReason}'
```

| Field | Meaning |
|---|---|
| `pending` | Slots the pool's distribution wants that no node fills yet. `0` on every other runtime. |
| `pendingReason` | Why the last placement attempt left them pending: `none_free` (no reachable, schedulable, idle server) or `none_fits` (idle servers exist, but none has enough RAM for the pool's `--memory`). |

Two things to know when reading these fields under HA: `pendingReason` is kept by the replica that attempted the placement, so another replica may show `pending > 0` with no reason. And a node kept on a dead server (see below) is a node, not a pending slot.

Each node in `pool list` also carries `serverName` (the server hosting it) and `serverState` (`reachable`, `unreachable` or `dead`).

Placement by label (pinning a pool to a class of servers) is not available yet; any qualifying server can receive any pool.

## When a server goes down

Liveness is measured from the last heartbeat, on the database clock, so every manager replica classifies a server the same way.

| Silence | Server state | What happens |
|---|---|---|
| Up to `heartbeatTimeoutSec` (30 s) | `reachable` | Normal operation. |
| Past `heartbeatTimeoutSec` | `unreachable` | The node keeps its slot. The router stops sending it statements as soon as the health probe fails. When the server comes back, its agent still runs the node (or restarts it after a reboot, the assignment is unchanged) and routing resumes on the next probe. |
| Past `reassignAfterSec` (10 min) | `dead` | The node's slot moves: the manager claims a free server and starts the node there. The returning server is told to stop its old node on its next heartbeat. |

The grace window exists because a reboot or a short network blip is cheaper to wait out than a cold node on another server. Shorten it (`QOD_FLEET_REASSIGN_AFTER_SEC=60`) when spare servers are plentiful and failover speed matters; set `0` to move at once, or `-1` to never move a node off its server.

**No free server.** If a server is dead and no other server qualifies, the dead server **keeps its assignment**. The pool shows `pendingReason: none_free`. If that server returns before any capacity appears, its agent still runs the node, the manager adopts it and routing resumes, with no restart. If a server joins first, the node moves there.

A node whose DuckDB process keeps crashing on a healthy server is not moved: the agent retries with backoff and the server listing shows the node's last error. Failing over after repeated crashes is a planned follow-up.

## Operate the fleet

The fleet commands are superuser-only (superuser session or the static API key), because the fleet is shared by every tenant. They answer `400 fleet_disabled` when the manager does not run the fleet runtime.

```bash
qod fleet servers           # every server: liveness, capacity, the node it runs
qod fleet drain srv-07      # stop scheduling onto it and move its node off
qod fleet undrain srv-07    # make it schedulable again
qod fleet remove srv-07     # forget it (drain and stop the agent first)
```

`qod fleet servers` (`GET /api/fleet/servers`) returns, per server:

| Field | Meaning |
|---|---|
| `name`, `advertiseHost`, `nodePort` | Identity and the address the manager dials. |
| `liveness` | `reachable`, `unreachable` or `dead`. |
| `silentSeconds` | Seconds since the last heartbeat. |
| `unschedulable` | `true` once drained. |
| `assignedNodeId`, `tenant`, `tenantDb`, `pool` | The node this server runs and its pool; empty while idle. |
| `nodeState`, `nodeError` | Agent-reported node state (`none`, `starting`, `running`, `failed`, `stopped`, or `stale` while the agent catches up with a new assignment) and its last error. |
| `cpus`, `memoryBytes` | Capacity the agent reported. |
| `agentVersion`, `duckdbVersion` | What the server runs. |
| `joinedAt`, `lastHeartbeatAt` | First and latest heartbeat. |

### Maintenance on a server

```bash
qod fleet drain srv-07
# patch, reboot, replace a disk ...
qod fleet undrain srv-07
```

Drain marks the server unschedulable and releases its node at once; the agent stops the node on its next heartbeat, and the manager's next reconcile starts it on another free server (or leaves the slot pending when there is none). Statements running on that node when it stops fail and follow the usual [retry rules](resilience.md#in-transaction-node-death), so drain in a quiet window or scale the pool up first. The node's routing entry is dropped on the next reconcile.

### Retire a server

```bash
qod fleet drain srv-07
sudo systemctl disable --now qod-agent      # on srv-07
qod fleet remove srv-07
```

`remove` answers `409 server_active` while the server is reachable and not drained. An unreachable server can be removed directly. An agent left running after `remove` rejoins on its next heartbeat as a new server, so always stop it first.

### Change a server's address

A known server name cannot come back from a different address or port unless it is drained: its heartbeat is refused with `409 address_change_refused`, which the agent logs. To re-address a server: `qod fleet drain`, restart the agent with the new `--advertise-host` or `--node-port`, `qod fleet undrain`.

### The Servers page

Superusers get a **Servers** entry in the [admin UI](admin-ui.md#servers-fleet) navigation. It shows the same table as `qod fleet servers` (liveness badge with the silence duration, capacity, node, pool, node state with its error on hover, agent and DuckDB versions), refreshed every few seconds, with **Drain** / **Undrain** and **Remove** actions per row. Remove asks for an in-page confirmation and stays disabled while the server is reachable and not drained. Pools with unfilled slots carry an `N pending` badge in the pool list, `(no server fits)` when the reason is `none_fits`.

## Resource limits per node

The pool's `--cpu` and `--memory` (the same flags that size pods on Kubernetes) are enforced by DuckDB on a fleet server:

```bash
qod pool create --tenant acme --db acme_sales --pool bi --size 3 --dual 3 --cpu 4 --memory 16Gi
qod pool set-resources --tenant acme --db acme_sales --pool bi --cpu 2 --memory 8Gi
```

| Pool setting | Becomes | Examples |
|---|---|---|
| `--cpu` | `SET threads = <cpu rounded up>` (minimum 1) | `500m` gives 1, `1.5` gives 2, `4` gives 4 |
| `--memory` | `SET memory_limit = '<MiB rounded down>MiB'` (minimum 64 MiB) | `4Gi` gives `4096MiB`, `2G` gives `1907MiB` |

- These are engine limits, not kernel limits: DuckDB caps its worker threads and buffer manager, but allocations outside the buffer manager can overshoot `memory_limit`. Leave headroom on the server.
- An explicit `SET threads` or `SET memory_limit` in the database or pool init SQL runs later and wins over the `--cpu` / `--memory` value.
- `--memory` is also the scheduling filter: a pool asking for `64Gi` is never placed on a server that reported 32 GiB of RAM.
- New values apply when a node next starts; restart the pool's nodes to apply them now.

## Ephemeral nodes

[Maintenance](maintenance.md) runs and [branch](branching.md) merges start a short-lived node of their own. In fleet mode they claim a free server like any other node and give it back when done. With no free server they fail with `no fleet server` and retry on their own schedule.

Two ways to size for this:

- Keep one spare server per maintenance run or merge you expect to run at the same time.
- Set `QOD_FLEET_EPHEMERAL=local` to run these nodes on the manager host instead, on the local port range, at no fleet cost. This needs a `duckdb` binary on the manager host (`DUCKDB_BIN` or `PATH`); the manager refuses to boot without one.

## Security

**The join token is as sensitive as the control-plane Postgres password.** Whoever holds it can join a server and will receive the credentials of every pool scheduled onto that server: the metastore `pgPassword` and, for encrypted databases, the encryption key. Handle it accordingly:

- Pass it through the environment, never on the command line.
- Keep unit files and plists readable by root only.
- Watch `qod fleet servers` for names you did not install.
- Rotate on any suspicion: set a new `QOD_FLEET_JOIN_TOKEN` on the managers and restart them, then update every agent. From that point a heartbeat carrying the old value is refused (`401 fleet_unauthorized`), so an agent you have not updated yet goes `unreachable`, then `dead` after `reassignAfterSec`: update agents within that window. Rotation removes no server by itself; drain and remove any server you do not trust.

**A known server name cannot be taken over.** A heartbeat for an existing name from a different address or port is refused unless that server is drained, so a machine holding the token cannot impersonate an idle server either.

**The manager-to-node hop is plain HTTP**, carrying the node token and result rows. That is true in every runtime; in local and Kubernetes modes the hop stays on one host or one cluster network, in fleet mode it crosses whatever sits between managers and servers. Fleet mode therefore requires a private network between them, and nodes bind only the advertised interface. Do not route this traffic over the internet.

The agent-to-manager hop carries the assignments, so the agent insists on HTTPS (see [Prerequisites](#prerequisites)).

## High availability

Fleet is an HA-capable runtime, like Kubernetes: `QOD_HA_ENABLED=true` with `QOD_RUNTIME_TYPE=fleet` runs several active-active managers against the same control-plane Postgres. Point every agent at a load-balanced URL in front of the managers; any replica accepts heartbeats and claims, because both are Postgres writes. Reconcile, and with it pending-slot filling, grace expiry and respawns, runs on the elected leader only. See [Resilience and recovery](resilience.md) for the HA model.

## Limits and follow-ups

Not available in this version:

- A Windows agent.
- TLS between manager and nodes (a TLS front in the agent is planned; until then, the private network is mandatory).
- Per-server credentials and an admission step replacing the shared join token.
- Placement by server label.
- Moving a node off a server after repeated crashes.
- Kernel-enforced cpu and memory limits (systemd scope, cgroups).
- More than one node per server.
- MCP tools for the fleet: use the CLI, REST or the admin UI.
