---
id: deploy-fleet
title: "Fleet deployment: nodes on your own servers, no Kubernetes"
sidebar_label: Fleet (bare servers)
description: "Run DuckDB nodes across many Linux or macOS servers without Kubernetes: servers join with qod fleet join, the manager schedules one node per server from a shared fleet."
keywords: ["duckdb cluster", "bare metal", "fleet", "qod fleet join", "systemd", "launchd", "no kubernetes", "duckdb deployment"]
---

Audience: platform engineer or DBA who has several servers (VMs or physical hosts) but no Kubernetes cluster.
Scenario: one or more managers, a shared PostgreSQL, a shared object store, and a pool of Linux or macOS servers that each run one DuckDB node.

```bash
# Manager (one host, or several under HA)
uv tool install qod            # or: pip install qod
export QOD_RUNTIME_TYPE=fleet
export QOD_FLEET_JOIN_TOKEN="$(openssl rand -hex 32)"   # keep it: every server needs it
qod start

# Every server that should run a node (Linux or macOS)
uv tool install qod            # or: pip install qod
export QOD_FLEET_JOIN_TOKEN=<the same token>
qod fleet join --manager https://mgr.internal:20900 [--advertise-host 10.0.3.17 ] [--name srv-07]
```

The rest of this page explains each line: what the manager needs, how to run `qod fleet join` as a service, how nodes are scheduled, what happens when a server goes down, and the security rules that come with a shared join token.

## When to choose fleet

QoD has three runtimes. They differ only in where the DuckDB nodes run; tenants, pools, RBAC, routing and every client connection string are identical.

| Runtime | `QOD_RUNTIME_TYPE` | Nodes run | Choose it when |
|---|---|---|---|
| Local | `local` (default) | Child processes of the manager, on the manager host | One server is enough. See [Single-server production deployment](deploy-single-server.md). |
| Fleet | `fleet` | One node per joined server, started by `qod fleet join` | You have several servers and no Kubernetes, or you want each node on dedicated hardware. |
| Kubernetes | `kubernetes` | One pod per node, created through the Kubernetes API | You already run a cluster. See [Kubernetes deployment](deploy-kubernetes.md). |

A fleet is a set of servers that joined by running `qod fleet join`. Joining means the server will run a quack node: each server runs **exactly one** node, and the manager decides which pool it serves. Servers are shared by every pool of every tenant; the manager hands a free server to whichever pool needs a node.

## Prerequisites

- **Linux or macOS servers.** `qod fleet join` is not available on Windows yet.
- **The `qod` CLI on every server** (`pip install qod`, or run it through `uvx qod fleet join ...`). The join process provisions a `duckdb` binary into its cache on first start; pass `--duckdb-bin /path/to/duckdb` to use one you installed yourself.
- **Shared object storage for every DuckLake data path.** A node can land on any server, so every database's `dataPath` must be an object-store URL (`s3://...`, `gs://...`, `az://...`) reachable from all servers. A local path would only exist on one of them. [Managed storage](managed-storage.md) satisfies this by construction.
- **The metastore PostgreSQL reachable from every server.** Nodes attach their DuckLake catalog directly, so each server must reach the Postgres host and port of every database it may serve.
- **A private network between managers and servers** (VPC, VLAN, WireGuard). The manager talks to nodes over plain HTTP; see [Security](#security).
- **An HTTPS URL for the manager's REST port.** The join process refuses a plain `http://` manager URL, because each assignment it receives carries database credentials. Put a TLS-terminating reverse proxy or load balancer in front of `:20900` (you need one under HA anyway), and list it in `QOD_FLEET_TRUSTED_PROXIES` so [join approval](#join-approval) sees each server's real address. `--insecure` accepts an `http://` URL; reserve it for tests on a trusted network.

## Configure the manager

Set `QOD_RUNTIME_TYPE=fleet` and a join token. Everything else has a working default.

| Key | Env var | Default | Meaning |
|---|---|---|---|
| `quack-on-demand.runtimeType` | `QOD_RUNTIME_TYPE` | `local` | Set to `fleet`. |
| `quack-on-demand.fleet.joinToken` | `QOD_FLEET_JOIN_TOKEN` | (none) | Shared secret every fleet heartbeat carries. Required: the manager refuses to boot in fleet mode without it. |
| `quack-on-demand.fleet.heartbeatSec` | `QOD_FLEET_HEARTBEAT_SEC` | `5` | Heartbeat interval. The manager returns it in every reply, so every server follows this one setting. |
| `quack-on-demand.fleet.heartbeatTimeoutSec` | `QOD_FLEET_HEARTBEAT_TIMEOUT_SEC` | `30` | Silence beyond this marks a server `unreachable`. Must be greater than `heartbeatSec`. |
| `quack-on-demand.fleet.reassignAfterSec` | `QOD_FLEET_REASSIGN_AFTER_SEC` | `600` | Silence beyond this marks a server `dead` and moves its node to a free server. `0` moves it as soon as the server is unreachable, `-1` never moves it. Otherwise must be at least `heartbeatTimeoutSec`. |
| `quack-on-demand.fleet.startupTimeoutSec` | `QOD_FLEET_STARTUP_TIMEOUT_SEC` | `120` | How long the manager waits for a server to report its new node running before giving the server back. |
| `quack-on-demand.fleet.stopTimeoutSec` | `QOD_FLEET_STOP_TIMEOUT_SEC` | `60` | How long the manager waits for a server to report a node stopped. A stop never fails: an unreachable server stops its node on its next heartbeat. |
| `quack-on-demand.fleet.ephemeral` | `QOD_FLEET_EPHEMERAL` | `fleet` | Where maintenance and branch-merge nodes run: `fleet` claims a server, `local` runs them on the manager host. See [Ephemeral nodes](#ephemeral-nodes). |
| `quack-on-demand.fleet.autoApprove` | `QOD_FLEET_AUTO_APPROVE` | `0.0.0.0/0,::/0` | Comma-separated CIDRs. A server whose heartbeat comes from one of them is approved as it joins; any other waits for `qod fleet approve`. Empty approves no one automatically. See [Join approval](#join-approval). |
| `quack-on-demand.fleet.trustedProxies` | `QOD_FLEET_TRUSTED_PROXIES` | (none) | Comma-separated CIDRs of the proxies and load balancers in front of the manager. Only their `X-Forwarded-For` header is believed when resolving a heartbeat's address. |

Invalid combinations (a timeout not above the heartbeat, an unknown `ephemeral` value, a malformed CIDR) are refused at boot with a message naming the key.

The usual production settings still apply: pin `QOD_API_KEY` and `QOD_SESSION_JWT_SECRET`, point `QOD_PG_*` at your control-plane Postgres, and follow [Hardening](hardening.md). See the [Configuration reference](/qod/reference/configuration) for every key.

## Join a server

On each server, run `qod fleet join` with the manager URL and the join token. Pass the token through the environment, never with `--join-token`: a command-line argument is visible to every local user in `ps`.

```bash
export QOD_FLEET_JOIN_TOKEN=<the join token>
qod fleet join --manager https://mgr.internal:20900 [--advertise-host 10.0.3.17] [--name srv-07]
```

`qod fleet join` keeps running: it heartbeats the manager and runs the node the manager assigns, so run it as a service (below).

> **Upgrading from 0.9.7:** the command was called `qod agent` and is gone, with no alias. Edit every systemd unit or launchd plist that runs `qod agent ...` to run `qod fleet join ...` with the same flags (the examples below also rename the units to `qod-fleet-join`), then restart it. The server keeps its name, approval and node.

The first heartbeat is the join. The server appears in `qod fleet servers` a few seconds later. With the default settings it is approved at once and becomes eligible for the next node the manager needs to place; when you restrict [join approval](#join-approval), a server from outside the allowed networks waits for `qod fleet approve` instead.

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

**Pick the advertise host deliberately.** On a host with a management interface and a data interface, the default guess can pick the wrong one, silently. The join process logs its choice at start (`advertise host 10.0.3.17 ... override with --advertise-host / --bind-host if this is not the data interface`); check that line, or always pass `--advertise-host`. Because `--bind-host` defaults to the advertise host, the node never listens on the management interface by accident.

The join process restarts its node itself when DuckDB crashes, backing off from 5 seconds to 5 minutes between attempts; the manager only sees the state reports. A node crash is never a scheduling event.

### Join approval

A server takes nodes only once it is approved, and a node's assignment is what carries database credentials. Approval therefore decides which machines ever see a credential.

`QOD_FLEET_AUTO_APPROVE` lists the networks trusted to join on their own, as comma-separated CIDRs:

- The default, `0.0.0.0/0,::/0`, approves every address, so the join token alone is enough. The manager logs a WARN at boot while the list is open like this.
- A narrower list, for example `10.0.3.0/24`, approves servers from that range as they join. A server from any other address joins as **pending**: it heartbeats and shows up in `qod fleet servers` and on the Servers page, but it never receives a node. Its `qod fleet join` process logs `waiting for approval` with a hint.
- An empty value approves no one automatically: every new server needs an admin.

Approve or refuse a pending server after checking where it came from:

```bash
qod fleet servers              # approval, sourceAddr, approvedSource, approvedBy, approvedAt
qod fleet approve srv-07       # let it take nodes
qod fleet remove srv-07        # refuse it, then stop its join process (otherwise it re-joins as pending)
```

`qod fleet approve` answers `409 source_unknown` while the server's source address is unknown (see the proxy notes below); approve it after a heartbeat with a known source.

The rules:

- The address judged is the one the heartbeat connection comes from, never the `--advertise-host` the join process reports.
- Widening the list approves waiting servers on their next heartbeat; narrowing it never evicts an approved server (drain and remove do that).
- Approval is kept across join-process restarts, drain and undrain. `qod fleet remove` forgets it, and a server that re-joins is judged again.
- Servers that were in the fleet before join approval existed stay approved (`approvedBy: upgrade`).

#### Approval is bound to the address it was given to

An approval belongs to the machine it was granted to, identified by the source address its heartbeats came from (`approvedSource` in `qod fleet servers`). Name, advertised host and port are what the join process reports, so they alone prove nothing: without the binding, anyone holding the join token could copy an approved server's name, host and port and receive its credentials.

- **Binding.** An automatic approval binds the address it was judged from. `qod fleet approve` binds the address of the server's latest heartbeat, the one `qod fleet servers` shows as `sourceAddr`: check it before approving.
- **A heartbeat from another address is refused** with `409 source_change_refused` and changes nothing: the server keeps its approval, its node and its binding, and the other machine gets no assignment. Two exceptions:
  - the new address is inside `QOD_FLEET_AUTO_APPROVE`: the approval moves to it (a move within networks you already trust);
  - the server is drained and runs no node: its approval is reset and the new address is judged like a new join.
- **Servers approved before binding existed** (`approvedBy: upgrade`) have no bound address yet. Their first heartbeat binds it, but only from an address inside `QOD_FLEET_AUTO_APPROVE`. From anywhere else the heartbeat is refused with `409 approval_unbound`. With the default open list every server binds on its next heartbeat and nothing changes; with a narrowed list, re-approve each server outside it once (below).
- **The node keeps running on a refused server** (the join process never stops it on a `409`), but the manager stops routing to it and, after `reassignAfterSec`, moves its slot to another server.

To move an approved server to a new address, or to clear `source_change_refused` / `approval_unbound` on a legitimate server:

```bash
qod fleet drain srv-07       # its node moves off; the next heartbeat from the new address resets approval
qod fleet servers            # wait until srv-07 shows approval: pending, and check sourceAddr
qod fleet approve srv-07     # binds the new address
qod fleet undrain srv-07     # schedulable again
```

Skip the approve step when the new address is inside `QOD_FLEET_AUTO_APPROVE`: it is approved again on its own. Forgetting the undrain leaves an approved server that never receives a node.

The binding is by IP address, with the limits that implies: machines behind the same NAT or the same unlisted proxy share one source address, and a server whose address changes (DHCP, or a dual-stack host that switches between IPv4 and IPv6) is refused until it is drained and approved again.

**Behind a proxy, set `QOD_FLEET_TRUSTED_PROXIES`.** When servers reach the manager through a proxy or load balancer, the connection comes from that intermediary, not from the server. That covers two common setups: a TLS-terminating proxy in front of `:20900` (the manager's REST port has no TLS of its own) and the load balancer in front of HA replicas. Without the setting, every server appears to come from the proxy, so the list approves all of them (proxy inside a listed range) or none of them. Set `QOD_FLEET_TRUSTED_PROXIES` to the proxy's addresses, on every manager replica; their `X-Forwarded-For` header is then believed, read from the right and skipping trusted hops. When servers connect straight to the manager's own `host:20900`, leave it empty.

- Never list a range that contains untrusted clients: a client inside it could choose its own address.
- A missing or malformed `X-Forwarded-For` behind a trusted proxy leaves the address unknown. An unknown address is never approved automatically, and `qod fleet approve` refuses it (`409 source_unknown`), so a proxy that does not send the header keeps its servers pending. Entries that carry a port (`10.0.3.17:51234`) count as malformed. A heartbeat with several `X-Forwarded-For` header lines fails with `400`. Configure the proxy to send one header line of plain addresses, appending to any value it received.

### Run `qod fleet join` under systemd (Linux)

`/etc/systemd/system/qod-fleet-join.service`:

```ini
[Unit]
Description=quack-on-demand fleet join
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/qod fleet join --manager https://mgr.internal:20900 --advertise-host 10.0.3.17 --name %H
Environment=QOD_FLEET_JOIN_TOKEN=<the join token>
Restart=always
KillMode=control-group

[Install]
WantedBy=multi-user.target
```

```bash
sudo chmod 600 /etc/systemd/system/qod-fleet-join.service   # the token is in it
sudo systemctl daemon-reload
sudo systemctl enable --now qod-fleet-join
journalctl -u qod-fleet-join -f
```

`KillMode=control-group` makes `systemctl stop` take the node down with the join process. If the join process itself is killed hard, the next start finds the orphaned node through the pidfile in its state directory and stops it before doing anything else.

### Run `qod fleet join` under launchd (macOS)

`/Library/LaunchDaemons/ai.starlake.qod-fleet-join.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ai.starlake.qod-fleet-join</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/qod</string>
    <string>fleet</string>
    <string>join</string>
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
sudo chmod 600 /Library/LaunchDaemons/ai.starlake.qod-fleet-join.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/ai.starlake.qod-fleet-join.plist
```

### What the node inherits from the join process

The node does not inherit the join process's whole environment: the join process holds the join token, and a node runs tenant SQL. It receives only `PATH`, `HOME`, `TMPDIR`, `LANG`, `LC_ALL`, `TZ`, `USER`, `LOGNAME`, `SHELL`, the proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` and their lowercase forms), `DUCKDB_BIN`, `QOD_APP_HOME`, the object-storage settings `QOD_S3_*` and `QOD_AZURE_*`, plus the assignment the manager sends.

Metastore connection settings that a server needs go on the join process's unit and are passed through:

| Variable | Set it when |
|---|---|
| `PG_ADMIN_DB` | The database `CREATE DATABASE` runs from is not `postgres`. |
| `PGSSLMODE`, `PGSSLROOTCERT`, `PGSSLCERT`, `PGSSLKEY` | The metastore Postgres is reached over TLS. |
| `PGCONNECT_TIMEOUT` | The metastore is slow to accept connections. |
| `SSL_CERT_FILE` | A custom CA bundle is needed for outbound TLS. |

Anything else exported on the join process never reaches a node.

## How scheduling works

When a pool needs a node (create, scale up, a respawn), the manager claims one server from the fleet in a single Postgres statement. A server qualifies when it is:

- reachable (heard from within `heartbeatTimeoutSec`),
- not drained,
- not already running a node,
- large enough: its reported RAM is at least the pool's `--memory`, when the pool sets one. A server that reports no capacity always fits.

Servers are claimed oldest-joined first. The claim is atomic, so two managers under HA never hand out the same server. The manager then waits for that server to report the node running (up to `startupTimeoutSec`) before routing to it.

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
| Past `heartbeatTimeoutSec` | `unreachable` | The node keeps its slot. The router stops sending it statements as soon as the health probe fails. When the server comes back, its join process still runs the node (or restarts it after a reboot, the assignment is unchanged) and routing resumes on the next probe. |
| Past `reassignAfterSec` (10 min) | `dead` | The node's slot moves: the manager claims a free server and starts the node there. The returning server is told to stop its old node on its next heartbeat. |

The grace window exists because a reboot or a short network blip is cheaper to wait out than a cold node on another server. Shorten it (`QOD_FLEET_REASSIGN_AFTER_SEC=60`) when spare servers are plentiful and failover speed matters; set `0` to move at once, or `-1` to never move a node off its server.

**No free server.** If a server is dead and no other server qualifies, the dead server **keeps its assignment**. The pool shows `pendingReason: none_free`. If that server returns before any capacity appears, its join process still runs the node, the manager adopts it and routing resumes, with no restart. If a server joins first, the node moves there.

A node whose DuckDB process keeps crashing on a healthy server is not moved: the join process retries with backoff and the server listing shows the node's last error. Failing over after repeated crashes is a planned follow-up.

## Operate the fleet

The fleet commands are superuser-only (superuser session or the static API key), because the fleet is shared by every tenant. They answer `400 fleet_disabled` when the manager does not run the fleet runtime.

```bash
qod fleet servers           # every server: liveness, approval, capacity, the node it runs
qod fleet approve srv-07    # let a pending server take nodes
qod fleet drain srv-07      # stop scheduling onto it and move its node off
qod fleet undrain srv-07    # make it schedulable again
qod fleet remove srv-07     # forget it (drain an approved server and stop the join process first)
```

`qod fleet servers` (`GET /api/fleet/servers`) returns, per server:

| Field | Meaning |
|---|---|
| `name`, `advertiseHost`, `nodePort` | Identity and the address the manager dials. |
| `liveness` | `reachable`, `unreachable` or `dead`. |
| `silentSeconds` | Seconds since the last heartbeat. |
| `unschedulable` | `true` once drained. |
| `assignedNodeId`, `tenant`, `tenantDb`, `pool` | The node this server runs and its pool; empty while idle. |
| `nodeState`, `nodeError` | Server-reported node state (`none`, `starting`, `running`, `failed`, `stopped`, or `stale` while the join process catches up with a new assignment) and its last error. |
| `cpus`, `memoryBytes` | Capacity the join process reported. |
| `qodVersion`, `duckdbVersion` | What the server runs. |
| `joinedAt`, `lastHeartbeatAt` | First and latest heartbeat. |
| `approval` | `approved`, or `pending` while the server waits for `qod fleet approve`. |
| `approvedBy`, `approvedAt` | `auto` (its address is in `QOD_FLEET_AUTO_APPROVE`), `upgrade` (joined before join approval existed) or the approving admin, and when. |
| `sourceAddr` | The address the latest heartbeat came from, resolved by the manager (not reported by the join process). |
| `approvedSource` | The address the approval is [bound to](#approval-is-bound-to-the-address-it-was-given-to); empty while pending, and for a server approved before binding existed until its first heartbeat from inside `QOD_FLEET_AUTO_APPROVE`. |

### Maintenance on a server

```bash
qod fleet drain srv-07
# patch, reboot, replace a disk ...
qod fleet undrain srv-07
```

Drain marks the server unschedulable and releases its node at once; the join process stops the node on its next heartbeat, and the manager's next reconcile starts it on another free server (or leaves the slot pending when there is none). Statements running on that node when it stops fail and follow the usual [retry rules](resilience.md#in-transaction-node-death), so drain in a quiet window or scale the pool up first. The node's routing entry is dropped on the next reconcile.

### Retire a server

```bash
qod fleet drain srv-07
sudo systemctl disable --now qod-fleet-join      # on srv-07
qod fleet remove srv-07
```

`remove` answers `409 server_active` while an approved server is reachable and not drained. An unreachable server, or a pending one (it holds no node), can be removed directly. A join process left running after `remove` rejoins on its next heartbeat as a new server, judged again by [join approval](#join-approval), so always stop it first.

### Change a server's address

A known server name cannot come back from a different address or port unless it is drained: its heartbeat is refused with `409 address_change_refused`, which the join process logs. To re-address a server: `qod fleet drain`, restart the join process with the new `--advertise-host` or `--node-port`, then `qod fleet undrain`. A re-address is accepted only once the drain has released the server's node (a heartbeat in between is refused and the join process retries). The move resets the server's approval and judges the new address: inside `QOD_FLEET_AUTO_APPROVE` it is approved again at once; otherwise wait until `qod fleet servers` shows it pending, run `qod fleet approve`, and only then undrain it (see [Approval is bound to the address it was given to](#approval-is-bound-to-the-address-it-was-given-to)).

### The Servers page

Superusers get a **Servers** entry in the [admin UI](admin-ui.md#servers-fleet) navigation. It shows the same table as `qod fleet servers` (liveness badge with the silence duration, capacity, node, pool, node state with its error on hover, qod and DuckDB versions), refreshed every few seconds, with **Drain** / **Undrain** and **Remove** actions per row. A server waiting for approval carries a `pending approval` badge and an **Approve** action, and the address column adds the heartbeat's source address when it differs from the advertised one. Remove asks for an in-page confirmation and stays disabled while an approved server is reachable and not drained. Pools with unfilled slots carry an `N pending` badge in the pool list, `(no server fits)` when the reason is `none_fits`.

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

**The join token is as sensitive as the control-plane Postgres password.** Whoever holds it can join a server and, once that server is approved, will receive the credentials of every pool scheduled onto it: the metastore `pgPassword` and, for encrypted databases, the encryption key. With the default [join approval](#join-approval) setting every joining server is approved at once, so the token alone is enough. Restricting `QOD_FLEET_AUTO_APPROVE` to your server networks limits a leaked token to those networks: from anywhere else it only yields a pending entry with no node and no credential. Handle the token accordingly:

- Pass it through the environment, never on the command line.
- Keep unit files and plists readable by root only.
- Restrict `QOD_FLEET_AUTO_APPROVE` to the networks your servers live on, or set it empty and approve each server by hand.
- Watch `qod fleet servers` for names you did not install, and remove pending servers you do not recognize (then find and stop their join processes).
- Rotate on any suspicion: set a new `QOD_FLEET_JOIN_TOKEN` on the managers and restart them, then update every server. From that point a heartbeat carrying the old value is refused (`401 fleet_unauthorized`), so a server you have not updated yet goes `unreachable`, then `dead` after `reassignAfterSec`: update servers within that window. Rotation removes no server by itself; drain and remove any server you do not trust.

**A known server name cannot be taken over.** A heartbeat for an existing name from a different address or port is refused unless that server is drained, so a machine holding the token cannot impersonate an idle server either. When a drained server does change address, its approval is reset and the new address is judged again, so the move cannot carry an approval to a different machine. Copying an approved server's name, host and port exactly does not help either: the approval is [bound to the source address](#approval-is-bound-to-the-address-it-was-given-to) it was granted to, and a heartbeat from anywhere else is refused (`409 source_change_refused`) unless that address is itself inside `QOD_FLEET_AUTO_APPROVE`. The residual exposure is a machine that shares the approved server's source address (same NAT, or an unlisted proxy), and anything inside the auto-approve networks, which you trust by listing them.

**The manager-to-node hop is plain HTTP**, carrying the node token and result rows. That is true in every runtime; in local and Kubernetes modes the hop stays on one host or one cluster network, in fleet mode it crosses whatever sits between managers and servers. Fleet mode therefore requires a private network between them, and nodes bind only the advertised interface. Do not route this traffic over the internet.

The server-to-manager hop carries the assignments, so the join process insists on HTTPS (see [Prerequisites](#prerequisites)).

## High availability

Fleet is an HA-capable runtime, like Kubernetes: `QOD_HA_ENABLED=true` with `QOD_RUNTIME_TYPE=fleet` runs several active-active managers against the same control-plane Postgres. Point every server at a load-balanced URL in front of the managers; any replica accepts heartbeats and claims, because both are Postgres writes. List that load balancer in `QOD_FLEET_TRUSTED_PROXIES` on every replica, with the same `QOD_FLEET_AUTO_APPROVE` everywhere, so [join approval](#join-approval) sees each server's real address whichever replica answers. Approval is stored in the shared control plane, so an approval made on one replica holds on all of them. Reconcile, and with it pending-slot filling, grace expiry and respawns, runs on the elected leader only. See [Resilience and recovery](resilience.md) for the HA model.

