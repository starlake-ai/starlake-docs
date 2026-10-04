---
id: mcp
title: "MCP server: AI agents querying DuckDB under RBAC"
sidebar_label: "MCP server (AI agents)"
description: "Let Claude Code, Claude Desktop or Cursor query DuckDB through the embedded MCP server, with the same RBAC, row and column policies as any SQL client."
keywords: ["duckdb mcp", "mcp server", "ai agents", "claude", "cursor", "rbac"]
---

The manager embeds an MCP (Model Context Protocol) server at `POST /mcp` on the REST port (default `:20900`), so AI agents such as Claude Code, Claude Desktop, or Cursor can discover schemas, run SQL with full RBAC/RLS/CLS enforcement, use DuckLake time travel, and (for admin credentials) operate pools and nodes.

The transport is stateless Streamable HTTP: each POST carries one JSON-RPC message and the response is plain JSON. There is no SSE, no server push, and no session id, so any HA replica answers any request. `GET /mcp` returns 405.

MCP gives an agent tools on the manager; the [operator skill](/qod/connecting/agent-skill) gives it the operational playbook for the `qod` CLI. They combine well.

## Authentication

`/mcp` accepts exactly two credentials in the `Authorization: Bearer <token>` header:

| Credential | Principal |
|---|---|
| Personal access token (`qod_pat_...`) | The owning user, with that user's live tenant, role, and grants - narrowed by any scope minted onto the token |
| The static API key (`QOD_API_KEY`) | Superuser-equivalent; only when the key is set non-empty |

Session JWTs, passwords, and missing headers are all 401. `/mcp` never admits unauthenticated requests.

Create a PAT from the profile page in the UI, or with the CLI:

```bash
qod auth pat create --name claude-code
# the token is printed ONCE; store it now
```

By default a PAT carries its owner's full permissions; the scope flags described under [Scoped tokens and delegation](#scoped-tokens-and-delegation) can mint it narrower. A token can be revoked at any time (`qod auth pat revoke --id <id>`, or the profile page); revoking cascades to every token minted from it. A revoked or expired token stays visible in the listing until you discard it with `qod auth pat delete --id <id>` (or the profile page's Delete button); a live token must be revoked before it can be deleted. Tenant-scoped principals get their tenant inferred from the PAT owner; superuser and static-key callers pass an explicit `tenant` argument on tools that need one.

## Scoped tokens and delegation

A token can be minted narrower than its owner, so an agent holds a credential it cannot exceed even when fully compromised by an injected instruction. Every axis is optional on `qod auth pat create` (REST: the same field names on `POST /api/auth/pat/create`):

| Axis | CLI flag | Meaning |
|---|---|---|
| `roles` | `--role` (repeatable) | Restrict the token to these roles |
| `databases` | `--database` (repeatable) | Restrict the token to these databases |
| `pools` | `--pool` (repeatable) | Restrict the token to these pools |
| `tools` | `--tool` (repeatable) | Restrict the MCP tool surface the token may call |
| `verbCeiling` | `--verb-ceiling` | Cap write power: `RO`, `RW`, `DDL` or `ALL` |
| `dropAdmin` | `--drop-admin` | Strip the owner's superuser/admin standing from this token |
| `stmtTimeoutMs` | `--stmt-timeout-ms` | Per-statement timeout, milliseconds |
| `maxRows` | `--max-rows` | Row cap on this token's queries |

An axis left out is unrestricted on that axis (the token inherits the owner's reach); an axis sent as an empty array restricts the token to nothing on that axis. Scope always intersects the owner's grants and can never widen them - a mint request that tries to widen any axis is refused, naming the axis. Row-level and column-level policies that apply to the owner apply to every token they mint, untouched.

Tokens mint tokens. A PAT presented on the REST API may create a further-scoped child of itself, list its own descendants, and revoke or delete within its own subtree only - never itself, a sibling, its parent, or any other token of its owner. An axis narrowed at mint time can only narrow further down the chain, a child's expiry is clamped to its parent's, and chains are depth-capped (`QOD_PAT_MAX_DEPTH`, default 8). Revoking a token revokes its whole subtree in the same statement, so a stolen token cannot be rolled forward past its own revocation by minting a successor first.

A typical agent credential - read-only, one database, bounded per statement:

```bash
qod auth pat create --name analyst-agent \
  --database acme_tpch --verb-ceiling RO \
  --stmt-timeout-ms 30000 --max-rows 10000
```

## Client configuration

Claude Code:

```bash
claude mcp add --transport http qod http://localhost:20900/mcp \
  --header "Authorization: Bearer qod_pat_..."
```

Claude Desktop or any client that takes a JSON server entry:

```json
{
  "url": "https://your-manager:20900/mcp",
  "headers": { "Authorization": "Bearer qod_pat_..." }
}
```

## Tools: data tier (every authenticated principal)

| Tool | Arguments | Returns |
|---|---|---|
| `run_sql` | `sql`, `database`, `pool?`, `branch?`, `max_rows?` | Columns and rows as JSON, a `truncated` flag, rows affected for writes |
| `list_databases` | superuser: `tenant?` | Tenant databases with kind and pools |
| `list_tables` | `database`, `schema?`, `branch?` | Schemas and tables |
| `describe_table` | `database`, `schema`, `table`, `branch?`, `iceberg?` | Columns and types plus a few sample rows |
| `table_history` | `database`, `schema`, `table`, `limit?`, `iceberg?` | Snapshot history with change verbs |
| `list_snapshots` | `database`, `limit?` | Snapshots and tags, for time-travel queries (`AT (VERSION => n)`) |
| `my_usage` | none | Own usage counters and recent statements (PAT principals only) |
| `create_branch` | `database`, `name`, `ttl_hours?` | A writable zero-copy branch of the database (see [Branching](/qod/operating/branching)) |
| `list_branches` | `database`, `include_terminal?` | Live branches, or every branch with `include_terminal` |
| `branch_changes` | `database`, `branch`, `counts?` | Touched tables with kind and row counts, conflicts against main, merge verdict |
| `diff` | `database`, `branch`, `schema`, `table`, `limit?`, `cursor?`, `change_type?` | Row-level diff of one table between the branch's fork and head |
| `propose_merge` | `database`, `branch` | Records a merge request with the change set as of now |
| `discard` | `database`, `branch` | Discards a branch the caller owns (or any branch, as an admin) |

The `branch` argument on `run_sql`, `list_tables` and `describe_table` routes the call to that branch's own pool and catalog; `database` stays the parent name so token scopes keep applying. The `iceberg` argument on `describe_table` and `table_history` names an attached [Iceberg source](/qod/operating/iceberg#browsing-a-catalog); the schema and table are then read inside that catalog. It goes through the same admin-only gate as the REST views, so it needs an admin principal, and Iceberg snapshot ids come back as strings (time travel with `run_sql` and `AT (VERSION => <id>)`). `describe_table` returns the current table detail and files, plus a sample run as the caller that is dropped rather than failing the call when it cannot run. There is deliberately no merge tool: merging is a human action through the admin console, the CLI or REST, by a principal other than the proposer. A token minted with `branch_only` is refused any write on the live database (`write_requires_branch`) while reads and branch writes work as granted.

`run_sql` executes through the same in-process path as the FlightSQL edge: statement validation (ACL), classification, routing, then the node. RBAC verbs decide whether writes are allowed, RLS/CLS apply, and suspended pools wake on the first statement exactly as they do for FlightSQL clients. Results are capped server-side by `QOD_MCP_MAX_ROWS` (default 500); the tool's `max_rows` argument can only lower the cap, and truncated results carry `truncated: true` so the agent aggregates or filters instead of paginating blindly.

## Tools: admin tier (admin or superuser principals)

| Tool | Notes |
|---|---|
| `list_pools`, `get_pool_status` | Nodes, health, served counts, suspended flag, autoscale band |
| `scale_pool` | Band refusals (`outside_band`) surface as tool errors with the reason |
| `suspend_pool`, `resume_pool` | Scale-to-zero and wake |
| `restart_node`, `quarantine_node`, `unquarantine_node` | Node lifecycle |
| `active_statements`, `kill_statement` | Inspect and kill running statements |
| `run_maintenance`, `maintenance_runs` | Trigger and inspect managed maintenance |
| `create_pool`, `stop_pool`, `delete_pool` | Pool lifecycle |
| `set_pool_autoscale`, `set_pool_resources`, `set_pool_pod_template`, `set_pool_disabled`, `set_node_max_concurrent` | Pool settings; band and quota refusals surface as tool errors |
| `set_pool_lockdown` | Node-lockdown override (`inherit`, `on`, `off`); superuser only |
| `create_tag`, `protect_tag`, `delete_tag` | Deleting a protected tag is refused; there is no unprotect tool, so a protected tag stays protected over MCP |
| `restore_snapshot`, `undrop_table`, `list_recoverable` | Restore and undrop run as the PAT's owner with the token's restriction, so the ACL applies and a table the owner cannot write answers `acl_denied`; the restore `dry_run` reports aggregate change counts only |
| `get_maintenance_policy`, `upsert_maintenance_policy`, `delete_maintenance_policy` | Managed maintenance policies |
| `list_tenants`, `create_tenant`, `delete_tenant`, `set_tenant_disabled`, `set_tenant_auth`, `set_tenant_acl` | Tenant lifecycle and settings; `delete_tenant` is refused while the tenant still has pools |
| `list_databases_admin`, `create_database`, `update_database`, `delete_database`, `metastore_defaults` | Database (tenant-db) lifecycle; `delete_database` with `purge_managed_data` also drops manager-provisioned storage |
| `list_users`, `create_user`, `update_user`, `delete_user`, `user_effective_permissions` | Users (see [User creation over MCP](#user-creation-over-mcp)) |
| `list_roles`, `create_role`, `delete_role`, `list_role_permissions`, `grant_role_permission`, `revoke_role_permission` | Roles and their table permissions |
| `list_column_policies`, `create_column_policy`, `update_column_policy`, `delete_column_policy`, `list_row_policies`, `create_row_policy`, `update_row_policy`, `delete_row_policy` | Column masking and row filters on a role |
| `list_groups`, `create_group`, `delete_group`, `add_membership`, `remove_membership`, `list_group_role_memberships` | Groups and user, group and role memberships |
| `list_pool_permissions`, `grant_pool_permission`, `revoke_pool_permission` | Pool access grants |
| `list_federated_sources`, `upsert_federated_source`, `delete_federated_source`, `set_federated_secret`, `delete_federated_secret` | Federated sources and their secrets; refused with `federation_disabled` when federation is not enabled |
| `create_pat`, `list_pats`, `revoke_pat`, `delete_pat` | Self-scoped: a token mints, lists, revokes and deletes only within its own subtree, and a child's scope can only narrow (see [Scoped tokens and delegation](#scoped-tokens-and-delegation)); the token value is returned once |
| `manifest_export`, `manifest_import` | Control-plane manifest round-trip; `manifest_import` is superuser only |
| `get_config` | The manager's configuration registry; superuser only |
| `audit_search`, `statement_history`, `usage_report`, `usage_trends` | Audit log, statement history and usage |

Built-in roles and groups keep their protection over MCP: a tool call that would delete or edit one answers `builtin_protected`, exactly as on REST.

### User creation over MCP

`create_user` takes `username`, `password`, `tenant` (omitting it creates a superuser, which only a superuser credential may do), `kind` (`user` by default, or `admin`: management rights, not an RBAC role), optional `email` and `must_change_password`, and the arrays `roles` and `groups` (role and group names in the tenant). An omitted array defaults to the built-in `qod_all_tables` / `qod_all_pools`, giving the user full access to every table and pool of the tenant; an empty array is refused, and so is an unknown name or either array on a superuser. `update_user` takes `id` plus any of `password`, `kind`, `email`, `must_change_password`, `enabled`. See [Built-in roles and groups](/qod/operating/rbac-model#built-in-roles-and-groups).

`tools/list` is computed per principal: a PAT owned by a `kind=user` account sees the data tier only; a tenant admin sees both tiers scoped to their tenant; superuser and static-key callers see both cross-tenant. `tools/call` re-checks the tier server-side. Tool calls land in the audit trail as the acting user.

## Not available over MCP

The admin tier covers nearly every REST mutation. A small set of operations has no MCP tool by design, whatever the credential:

- Interactive authentication flows: login, logout, password change, forgot and reset password, SSO and OIDC callbacks, SQL-token exchange
- Branch merge: merging is a human action by a principal other than the proposer (admin console, CLI or REST)
- The OPA policy dry run (`qod tenant opa-test`), a diagnostic for policy authors
- Fleet server management (join, heartbeat, approve, drain, remove)
- The SCIM 2.0 provisioning endpoints, which are the identity provider's wire protocol
- Tag unprotect: once protected, a tag cannot be unprotected or deleted over MCP

Tool exposure does not bypass authorization: every tool runs through the same handlers as REST, with the tenant scope, the superuser-only checks, the built-in role and group protection and the token's own restriction applied.

## Errors

Protocol failures (bad token, malformed JSON-RPC, unknown method) come back as HTTP 401 or JSON-RPC error objects. Everything that happens inside a tool (an ACL denial, a SQL error, an `outside_band` refusal, a "pool is resuming" timeout) returns a normal `tools/call` result with `isError: true` and a message written for the agent to act on. Internal exceptions are sanitized to a generic message with a correlation id in the server log.

## Configuration

| Key | Default | Env | Meaning |
|---|---|---|---|
| `quack-on-demand.mcp.enabled` | `true` | `QOD_MCP_ENABLED` | Serve `POST /mcp` at all |
| `quack-on-demand.mcp.maxRows` | `500` | `QOD_MCP_MAX_ROWS` | Hard cap on rows returned by `run_sql` |

Statement execution inherits the edge's existing timeouts.

## Troubleshooting

- **401 on every call**: the bearer is not a live PAT (revoked, expired, owner disabled) or is a session JWT, which `/mcp` refuses by design. Mint a fresh PAT.
- **A tool is missing from `tools/list`**: the credential's tier does not include it; admin tools need an admin-owned PAT or the static key.
- **`run_sql`, `restore_snapshot` or `undrop_table` returns an ACL error**: the message names the table and missing verb; grant the owning role `RO`/`RW`/`DDL` as needed. These tools run as the PAT's owner, never as a superuser, so an admin-owned PAT still needs the table grants.
- **"pool is resuming"**: the target pool was suspended and is waking; retry in a few seconds.
