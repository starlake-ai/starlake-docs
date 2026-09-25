---
id: reference
title: Command reference
description: "Every qod CLI command by noun and verb, with flags, profiles and JSON output for scripting a DuckDB gateway from CI or a shell."
keywords: ["qod cli reference", "commands", "flags"]
---

Settings resolve flag > `QOD_*` env var > active profile > built-in default; see [The qod CLI](/qod/cli/) for the full table. `--profile NAME` and `--json` are top-level flags that go before the noun, e.g. `qod --json tenant list`; `qod --version` prints the CLI version.

Purposes below are one line each; run `qod <noun> <verb> --help` for the full flag list of any command.

## auth

| Command | Purpose |
|---|---|
| `qod login` | Mint a session, store it and the edge settings in the active profile. |
| `qod logout` | Revoke the current session token. |
| `qod whoami` | Verify the current session. |
| `qod auth mode` | Show the auth mode (db or oidc) the manager expects. |
| `qod auth change-password` | Change your own password (works pre-login; prompts for current and new). |
| `qod auth forgot-password` | Request a password-reset link (always answers 200; account existence stays hidden). |
| `qod auth reset-password` | Redeem a single-use reset link token and set a new password (prompts for both). |
| `qod auth pat create` | Create a personal access token (`--name`, optional `--expires-at`); the token prints once. Scope flags mint it narrower than the owner: repeatable `--role` / `--database` / `--pool` / `--tool`, plus `--verb-ceiling RO\|RW\|DDL\|ALL`, `--drop-admin`, `--stmt-timeout-ms`, `--max-rows`. A flag left out means unrestricted on that axis. |
| `qod auth pat list` | List your PATs (metadata only; token values are never shown again). Chained tokens show `parentId` and `depth`. |
| `qod auth pat revoke` | Revoke a PAT immediately (`--id`); cascades to every token minted from it. |
| `qod auth pat delete` | Discard a revoked or expired PAT from the listing (`--id`); a live token must be revoked first. |
| `qod health` | Liveness plus pool/node counts (open endpoint). |
| `qod ready` | Readiness probe: 503 until Postgres is reachable, 200 once it is (open endpoint). |

## tenant

| Command | Purpose |
|---|---|
| `qod tenant list` | List tenants. |
| `qod tenant create` | Create a tenant. |
| `qod tenant delete` | Delete a tenant (must have no pools). |
| `qod tenant set-disabled` | Enable or disable a tenant. |
| `qod tenant set-auth` | Change a tenant's auth provider/config. |

## database

| Command | Purpose |
|---|---|
| `qod database list` | List databases for a tenant. |
| `qod database create` | Create a tenant database. |
| `qod database update` | Update a tenant database's metastore/object-store/init settings. |
| `qod database delete` | Delete a tenant database. |

## pool

| Command | Purpose |
|---|---|
| `qod pool list` | List pools. |
| `qod pool create` | Create a pool. |
| `qod pool scale` | Change a pool's target size and role distribution. |
| `qod pool stop` | Stop a pool's nodes. |
| `qod pool delete` | Delete a pool. |
| `qod pool set-disabled` | Enable or disable a pool. |
| `qod pool set-autoscale` | Set or clear a pool's autoscale band (omit both bounds to clear). |
| `qod pool set-resources` | Set CPU/memory for a pool's nodes (pod request and limit on Kubernetes, DuckDB `threads` / `memory_limit` on a fleet). |
| `qod pool set-pod-template` | Set the Kubernetes pod template YAML for a pool. |
| `qod pool suspend` | Scale the pool to zero, keeping its distribution; wakes on the next query. |
| `qod pool resume` | Wake a suspended pool (respawn to its stored distribution). |
| `qod pool status` | One pool's live status: nodes, suspended/disabled flags, resources. |
| `qod pool set-lockdown` | Per-pool node-lockdown override (`--lockdown inherit\|on\|off`; `inherit` follows the global `QOD_NODE_LOCKDOWN`). Superuser only. |

## pool permission

| Command | Purpose |
|---|---|
| `qod pool permission list` | List pool access grants. |
| `qod pool permission grant` | Grant pool access to a user or group. |
| `qod pool permission revoke` | Revoke a pool access grant. |

## node

| Command | Purpose |
|---|---|
| `qod node quarantine` | Take a node out of routing rotation. |
| `qod node unquarantine` | Return a node to routing rotation. |
| `qod node restart` | Restart a node. |
| `qod node set-max-concurrent` | Set a node's max concurrent statement limit. |
| `qod node statements` | Recent statement history, newest first. |
| `qod node active-statements` | Currently running statements. |

## statement

| Command | Purpose |
|---|---|
| `qod statement kill` | Kill a running statement by id. |

## user

| Command | Purpose |
|---|---|
| `qod user list` | List users. |
| `qod user create` | Create a user (tenant-scoped, or `--superuser` for tenant-less); `--email` for password-reset links. |
| `qod user update` | Update a user's tenant, password, role, or email; `--no-enabled` locks the account, `--enabled` unlocks. |
| `qod user delete` | Delete a user. |
| `qod user effective` | Closure of roles, groups, table permissions, and pool grants. |

## role

| Command | Purpose |
|---|---|
| `qod role list` | List roles for a tenant. |
| `qod role create` | Create a role. |
| `qod role delete` | Delete a role. |

## role permission

| Command | Purpose |
|---|---|
| `qod role permission list` | List table permissions attached to a role. |
| `qod role permission grant` | Grant a table permission to a role. |
| `qod role permission revoke` | Revoke a table permission from a role. |

## role row-policy

| Command | Purpose |
|---|---|
| `qod role row-policy list` | List row-level security predicates on a role. |
| `qod role row-policy create` | Add a row-level security predicate. |
| `qod role row-policy update` | Update a row-level security predicate. |
| `qod role row-policy delete` | Delete a row-level security predicate. |

## role column-policy

| Command | Purpose |
|---|---|
| `qod role column-policy list` | List column-level security policies on a role. |
| `qod role column-policy create` | Add a column-level security policy. |
| `qod role column-policy update` | Update a column-level security policy. |
| `qod role column-policy delete` | Delete a column-level security policy. |

## group

| Command | Purpose |
|---|---|
| `qod group list` | List groups for a tenant. |
| `qod group create` | Create a group. |
| `qod group delete` | Delete a group. |

## membership

| Command | Purpose |
|---|---|
| `qod membership user-role add` | Add a user to a role. |
| `qod membership user-role remove` | Remove a user from a role. |
| `qod membership user-group add` | Add a user to a group. |
| `qod membership user-group remove` | Remove a user from a group. |
| `qod membership group-role add` | Add a role to a group. |
| `qod membership group-role remove` | Remove a role from a group. |
| `qod membership group-role list` | List roles held by a group. |

## catalog

| Command | Purpose |
|---|---|
| `qod catalog schemas` | List schemas in a tenant database. |
| `qod catalog tables` | List tables in a schema. |
| `qod catalog describe` | Describe a table's columns, optionally as of a snapshot/tag/timestamp. |
| `qod catalog snapshots` | List snapshots for a tenant database, optionally filtered to a table. |
| `qod catalog tags` | List snapshot tags of a tenant database (manage them with the `tag` verbs below). |
| `qod catalog history` | Snapshot history for a table (operation, author, time range filters). |
| `qod catalog preview` | Preview table rows, optionally as of a snapshot/tag/timestamp. |
| `qod catalog data-diff` | Row-level diff of a table between two snapshot selectors. |
| `qod catalog schema-diff` | Schema diff of a table between two snapshot selectors. |
| `qod catalog recoverable` | Dropped tables still recoverable via undrop. |
| `qod catalog undrop` | Recover a dropped table, optionally under a different name. |
| `qod catalog restore` | Roll a live table back to a prior snapshot or tag, as a new forward snapshot. |

```bash
qod catalog restore --tenant acme --db acme_tpch --schema tpch1 --table orders --to 480 --dry-run
```

`--to` takes a snapshot id or a tag name. `qod catalog restore` is non-destructive: it runs the
dry run first and prints the change summary, then prompts to confirm before writing the new
snapshot (skip the prompt with `--yes`, or stop after the preview with `--dry-run`). Requires an
ALL grant, or DDL plus RO/RW, on the table. For dropped tables, use `qod catalog undrop` instead.

## tag

| Command | Purpose |
|---|---|
| `qod tag create` | Tag a snapshot, optionally marking it protected. |
| `qod tag delete` | Delete a tag. |
| `qod tag protect` | Change a tag's protected flag. |

## maintenance

| Command | Purpose |
|---|---|
| `qod maintenance policy` | Show the maintenance policy for a scope. |
| `qod maintenance policy-upsert` | Create or update a maintenance policy. |
| `qod maintenance policy-delete` | Delete a maintenance policy. |
| `qod maintenance run` | Trigger a maintenance run. |
| `qod maintenance runs` | List past maintenance runs. |

## manifest

| Command | Purpose |
|---|---|
| `qod manifest export` | Export the whole control-plane topology as YAML. |
| `qod manifest import` | Import a topology manifest (YAML) into the control plane. |

## federation

| Command | Purpose |
|---|---|
| `qod federation list` | List federated sources. |
| `qod federation get` | Show one federated source. |
| `qod federation create` | Create a federated source. |
| `qod federation delete` | Delete a federated source. |
| `qod federation secret list` | List secrets referenced by a federated source's setup SQL. |
| `qod federation secret set` | Set a secret (inline value or external reference). |
| `qod federation secret delete` | Delete a secret. |

## audit

| Command | Purpose |
|---|---|
| `qod audit list` | List audit log entries with filters. |
| `qod audit actions` | Distinct audit action names, for filter values. |

## usage

| Command | Purpose |
|---|---|
| `qod usage` | Usage accounting rollups. |

## history

| Command | Purpose |
|---|---|
| `qod history statements` | List past statements with filters. |
| `qod history trends` | Aggregate statement trends over time. |

## profile

| Command | Purpose |
|---|---|
| `qod profile usage` | Your own daily statement counts. |
| `qod profile statements` | Your own most recent statements. |

## config

| Command | Purpose |
|---|---|
| `qod config client` | Edge host/port/TLS for client bootstrapping (open endpoint). |
| `qod config server` | Effective manager configuration. |
| `qod config profiles` | List local CLI profiles; marks the one this invocation resolved to. |
| `qod config use` | Set the sticky default profile (overridden per call by `--profile` / `QOD_PROFILE`). |

## fleet

Superuser only; the manager must run the [fleet runtime](/qod/operating/deploy-fleet).

| Command | Purpose |
|---|---|
| `qod fleet servers` | List joined servers with liveness (`reachable` / `unreachable` / `dead`), capacity, and the node each runs. |
| `qod fleet drain NAME` | Stop scheduling onto a server and move its node elsewhere (or leave the slot pending). |
| `qod fleet undrain NAME` | Make a drained server schedulable again. |
| `qod fleet remove NAME` | Forget a drained or unreachable server; stop its agent first or it rejoins. |

## agent

| Command | Purpose |
|---|---|
| `qod agent` | Join this server (Linux, macOS) to a fleet and run the node the manager assigns: `--manager URL`, join token from `QOD_FLEET_JOIN_TOKEN` (or `--join-token`, visible in `ps`), `--name`, `--advertise-host`, `--bind-host`, `--node-port` (default 21900), `--duckdb-bin`, `--state-dir`, `--insecure` (allow an `http://` manager URL). Runs in the foreground, meant for systemd or launchd; see [Fleet deployment](/qod/operating/deploy-fleet#join-a-server). |

## sql

| Command | Purpose |
|---|---|
| `qod sql` | Run SQL against the FlightSQL edge; one-shot or interactive REPL. |

## skill

| Command | Purpose |
|---|---|
| `qod skill install` | Copy the bundled [operator skill](/qod/connecting/agent-skill) where the chosen LLM discovers it; prompts for the platform (`--platform claude\|copilot\|gemini\|all` skips the prompt, `--project` targets `./.{platform}/skills`, `--dir` an exact directory). |
| `qod skill path` | Print the bundled skill's location inside the installed package. |

## launcher

Local boot and teardown; the full walkthrough is on the [manager jar page](/qod/reference/cli).

| Command | Purpose |
|---|---|
| `qod start` | Run a manager against your Postgres (release jar auto-downloaded; `--version` picks the release, `--jar` runs a local build, `--demo` the self-contained demo). |
| `qod stop` | Stop a running manager and its quack nodes. |
| `qod status` | Show whether a manager is running and what it is serving. |
| `qod setup` | Persist the env vars `qod start` reads (Postgres coordinates, admin credentials, API key) so it runs bare afterwards. |

`qod <noun> <verb> --help` prints every flag for any command above.
