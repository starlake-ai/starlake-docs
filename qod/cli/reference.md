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
| `qod login` | Mint a session, store it and the edge settings in the active profile. The password is prompted, or read from the first line of stdin with `--password-stdin` (CI). |
| `qod logout` | Revoke the current session token. |
| `qod whoami` | Verify the current credential: a session, or a PAT (its owner's identity and the token's scope). |
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
| `qod tenant set-auth` | Change a tenant's auth provider/config (`--auth-provider`, repeatable `--auth-config KEY=VALUE`). The write-only OIDC client secret never goes on argv: `--client-secret-prompt` (hidden, asked twice) or `--client-secret-stdin`; `--clear-client-secret` removes it (at most one of the three). Adding or changing a `clientSecretRef` needs a superuser. |
| `qod tenant set-acl` | Choose the tenant's data-access authorization: `--mode qod\|opa`, `--opa-url`, `--opa-policy-path`, write-only `--opa-token`. `--send-statement-text` is kept for compatibility and has no effect. |
| `qod tenant opa-test` | Dry-run an OPA decision for `--user` on `--pool`: pool access, or with `--sql` one statement run on a node of the running pool as that user and judged, never executed. Prints the input the node sends OPA (accesses with `kind`, `columns` and `via`, `locations`; never the SQL text) and the decision. Refusals: `409 pool_not_running` (it never wakes a pool), `400 single_statement_required`, `opa_mode_required`, `refused_before_opa` (a superuser), `nothing_to_authorize`, and `503 authz_unavailable` when the node cannot reach the manager. An OPA it cannot reach shows a non-superuser only "OPA unreachable or returned an error (see the manager log)". |
| `qod tenant location list\|add\|remove` | The local folders the tenant's users may read and write files in: an absolute folder under `<QOD_TENANT_FILES_ROOT>/<tenant id>/` (superusers and the tenant's admins). |

## database

| Command | Purpose |
|---|---|
| `qod database list` | List databases for a tenant. |
| `qod database create` | Create a tenant database. |
| `qod database update` | Update a tenant database's metastore/object-store/init settings. A tenant admin's `--init-sql` runs under an allowlist; a superuser re-saving it trusts it. |
| `qod database delete` | Delete a tenant database. |

## pool

| Command | Purpose |
|---|---|
| `qod pool list` | List pools. |
| `qod pool create` | Create a pool (`--init-sql` follows the database's initSql rule). |
| `qod pool scale` | Change a pool's target size and role distribution. |
| `qod pool stop` | Stop a pool's nodes. |
| `qod pool delete` | Delete a pool. |
| `qod pool set-disabled` | Enable or disable a pool. |
| `qod pool set-init-sql` | Set or clear (`--init-sql ''`) the SQL the pool's nodes run at start; a tenant admin's holds only allowlisted SETs, read-only PRAGMAs and `INSTALL` / `LOAD` of allowlisted extensions. Takes effect at the next node start. |
| `qod pool set-autoscale` | Set or clear a pool's autoscale band (omit both bounds to clear). |
| `qod pool set-resources` | Set CPU/memory for a pool's nodes (pod request and limit on Kubernetes, DuckDB `threads` / `memory_limit` on a fleet). |
| `qod pool set-pod-template` | Set the Kubernetes pod template YAML for a pool. |
| `qod pool suspend` | Scale the pool to zero, keeping its distribution; wakes on the next query. |
| `qod pool resume` | Wake a suspended pool (respawn to its stored distribution). |
| `qod pool status` | One pool's live status: nodes, suspended/disabled flags, resources. |

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
| `qod user create` | Create a user (tenant-scoped, or `--superuser` for tenant-less); `--kind admin\|user` (management rights, default `user`), repeatable `--role` / `--group` (RBAC role and group names, default `qod_all_tables` / `qod_all_pools`), `--email` for password-reset links. |
| `qod user update` | Update a user's tenant, password, kind (`--kind`), or email; `--no-enabled` locks the account, `--enabled` unlocks. |
| `qod user delete` | Delete a user. |
| `qod user effective` | Closure of roles, groups, table permissions, and pool grants. |
| `qod user s3 list\|remove` | A user's own S3 credentials as an admin sees them (secrets never shown); only the user adds them, with `qod profile s3 add`. |

## role

| Command | Purpose |
|---|---|
| `qod role list` | List roles for a tenant. |
| `qod role create` | Create a role (the `qod_` name prefix is reserved for the built-ins). |
| `qod role delete` | Delete a role (built-in roles are refused). |

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
| `qod group create` | Create a group (the `qod_` name prefix is reserved for the built-ins). |
| `qod group delete` | Delete a group (built-in groups are refused). |

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
| `qod catalog recoverable` | Dropped tables still recoverable via undrop (admins; regular users use `qod profile recoverable`). |
| `qod catalog undrop` | Recover a dropped table, optionally under a different name or `--from-snapshot` (admins; regular users use `qod profile undrop` or `UNDROP TABLE`). |
| `qod catalog restore` | Roll a live table back to a prior snapshot or tag, as a new forward snapshot. |

```bash
qod catalog restore --tenant acme --db acme_tpch --schema tpch1 --table orders --to 480 --dry-run
```

`--to` takes a snapshot id or a tag name. `qod catalog restore` is non-destructive: it runs the
dry run first and prints the change summary, then prompts to confirm before writing the new
snapshot (skip the prompt with `--yes`, or stop after the preview with `--dry-run`). Requires an
ALL grant, or DDL plus RO/RW, on the table. For dropped tables, use `qod catalog undrop` instead.
`restore` (its dry run included), `undrop`, `preview` and `data-diff` run their statements as the
caller: a session as its user, a PAT as its owner with the token's restriction (its databases,
pools, verb ceiling and branch-only flag, a branch counting as its parent database), so the node
judges them against that user's grants and column masking and row policies apply. None of them
runs as the manager's system principal. `data-diff` and the restore dry run read DuckLake's change
feed, which is refused to a user with any column or row policy; history reads are judged on the
table as it is now (see
[Earlier snapshots and the change feed](../operating/rbac-model.md#earlier-snapshots-and-the-change-feed)).

`schemas`, `tables`, `describe`, `history`, `preview` and `data-diff` also take `--iceberg ALIAS` to
read an attached external Iceberg catalog instead of the database's DuckLake catalog. Snapshot ids
are then strings, `describe` is current-only (no `--as-of*`), `preview` refuses `--as-of-tag`,
`history` refuses `--from` / `--to` / `--author`, `data-diff` refuses `--cursor` and its
`--change-type` is `added` or `removed`. See
[Browsing a catalog](/qod/operating/iceberg#browsing-a-catalog).

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
| `qod profile pools` | The pools you may connect to (the FlightSQL handshake's own decision, narrowed by a PAT's scope). |
| `qod profile recoverable` | The dropped tables of one of your own databases (`--db`, `--limit`, default 50) that you may recover: the name is free and your grants cover a read of it. |
| `qod profile undrop` | Recover one of them as you: `--db`, `--schema`, `--table`, optional `--as-name`. Needs a read grant on the table's last name and DDL in the schema. |
| `qod profile s3 list\|add\|remove` | Your own S3 keys, each under an `s3://` scope your statements reach files with. `add SCOPE --access-key-id ...` takes the secret from `--secret-stdin` or `--secret-prompt` (never argv), optional `--session-token-stdin` / `--session-token-prompt`, `--region`, `--endpoint`, `--url-style`. |

## config

| Command | Purpose |
|---|---|
| `qod config client` | Edge host/port/TLS for client bootstrapping (open endpoint). |
| `qod config server` | Effective manager configuration. |
| `qod config profiles` | List local CLI profiles; marks the one this invocation resolved to. |
| `qod config use` | Set the sticky default profile (overridden per call by `--profile` / `QOD_PROFILE`). |

## fleet

The admin commands are superuser only; the manager must run the [fleet runtime](/qod/operating/deploy-fleet). `qod fleet join` runs on the server that joins and authenticates with the join token instead.

| Command | Purpose |
|---|---|
| `qod fleet join` | Join this server (Linux, macOS) to a fleet and run the node the manager assigns: `--manager URL`, join token from `QOD_FLEET_JOIN_TOKEN` (or `--join-token`, visible in `ps`), `--name`, `--advertise-host`, `--bind-host`, `--node-port` (default 21900; each also read from `QOD_FLEET_NAME` / `QOD_FLEET_ADVERTISE_HOST` / `QOD_FLEET_BIND_HOST` / `QOD_FLEET_NODE_PORT`), `--qod-node-bin` (default: the qod-node the wheel bundles), `--state-dir`, `--insecure` (allow an `http://` manager URL). Long-running, meant for systemd or launchd; see [Fleet deployment](/qod/operating/deploy-fleet#join-a-server). |
| `qod fleet servers` | List joined servers with liveness (`reachable` / `unreachable` / `dead`), approval (`approved` / `pending`) and heartbeat source address, capacity, and the node each runs. |
| `qod fleet approve NAME` | Let a server that joined from outside `QOD_FLEET_AUTO_APPROVE` take nodes ([join approval](/qod/operating/deploy-fleet#join-approval)). |
| `qod fleet drain NAME` | Stop scheduling onto a server and move its node elsewhere (or leave the slot pending). |
| `qod fleet undrain NAME` | Make a drained server schedulable again. |
| `qod fleet remove NAME` | Forget a server: a pending one at any time, an approved one once drained or unreachable. Stop its `qod fleet join` process too, or it rejoins. |

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
| `qod serve` | Boot a persistent gateway over your own data (a `.duckdb` file, a parquet/csv directory, an object-store prefix) on an embedded Postgres, or the self-contained demo with `--demo`. The manager provisions the tenant, database and pool itself at boot (add-only: it never updates or deletes an existing one), so later boots need no credential. |
| `qod stop` | Stop a running manager and its quack nodes. |
| `qod admin reset-password` | Set a new superuser password straight in the control-plane database, clearing its lockout (works with the manager down). `--username` targets one superuser and re-enables it if disabled, reviving its personal access tokens; without it every configured admin name is reset and a disabled one stays disabled. |
| `qod status` | Show whether a manager is running and what it is serving (pools need a `qod login` session or `QOD_TOKEN`). |
| `qod setup` | Persist the env vars `qod start` reads (Postgres coordinates, auth and TLS toggles, any `QOD_*` / `PROXY_*` var) so it runs bare afterwards; `--unset NAME` removes a stored one. |

`qod <noun> <verb> --help` prints every flag for any command above.
