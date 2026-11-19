---
id: branching
title: Branching (agents propose, humans merge)
description: "Zero-copy branches of a DuckLake database: agents and pipelines write on a branch, humans review the row-level diff and merge into main."
keywords: ["ducklake branching", "zero-copy branch", "data branching", "agents"]
---

A branch is a writable, zero-copy clone of a DuckLake database at its current head. Agents and pipelines write on the branch, a human reviews the change set and the row-level diff, then merges it into main in one stamped, tagged snapshot. Reads and writes on a branch never touch the live database, and a branch-only token makes writing main impossible for the agent that holds it.

Branching applies to `ducklake` databases only, and a branch cannot itself be branched. To test Starflow pipelines on BigQuery or Snowflake production data, use [Starflow data branches](/starflow/guides/unit-tests/data-branches) instead.

## How a branch is built

Creating a branch clones the database's DuckLake catalog at the Postgres level: every `ducklake_*` metadata table is copied into a new database under one repeatable-read transaction, so the copy is a consistent snapshot even while the parent is being written. No Parquet is copied. The clone's file references are rewritten to the parent's absolute locations, and its data path points at a sibling prefix, `<parent prefix>__br_<id>/`, so new files written on the branch land there and nowhere else.

The clone is registered as a tenant-db of its own (`<parent>__br_<id>`), served by one pool (`__br_<id>`, a single dual node) that attaches the catalog under the **parent's** catalog name. That is what makes a branch transparent to clients: the same SQL, grants, row and column policies, and unqualified table names apply on the branch exactly as they do on main. The branch pool inherits the parent's pool sizing and idle-hibernation settings, so an idle branch scales to zero and wakes on its next statement.

The fork snapshot is recorded per branch and pinned: [managed maintenance](/qod/operating/maintenance) on the parent expires no snapshot at or after the oldest live branch's fork, so the files a branch reads in place stay put and main's changes since the fork stay readable for the merge. Branch catalogs are never maintained themselves, and a database with live branches cannot be deleted.

## Lifecycle

| Step | Who | What happens |
|---|---|---|
| create | anyone who can connect to a pool of the database | Clone at head, start the branch pool, start the TTL |
| write | the same principal, targeting the branch | Ordinary SQL through FlightSQL or MCP; the node judges it against the principal's grants, and RLS and CLS apply |
| changes and diff | anyone with access | Touched tables classified as created, dropped, recreated, modified or altered, with row counts counted as the requester; conflicts against main; row-level diff per table |
| propose | the branch owner or a tenant admin (anyone else gets 403 `not_owner`) | Records a merge request: the change set, the conflicts found against main's head, the conflict policy and keys, and the branch head; proposing again replaces the open request |
| merge | a tenant admin **other than the proposer**, not through a branch-only token | [Three-way merge](#three-way-merge) onto main in one snapshot, tagged, branch torn down |
| discard | the owner or a tenant admin | Pool, catalog and branch-only files freed; the row stays as history |
| expiry | the manager | Live branches past their TTL are discarded by a leader-gated sweep |

Branch names are lowercase: a letter first, then letters, digits, `_` or `-`, at most 48 characters. A name is free again once the branch is merged, discarded or expired.

### Targeting a branch

- FlightSQL and ADBC clients add a `branch=<name>` connection header next to `tenant` and `pool` (the Arrow Flight JDBC URL form is `?tenant=acme&pool=bi&branch=feature-x`). Authorization runs against the named parent pool; only the routing target is swapped to the branch's pool.
- `qod sql --branch feature-x ...` sends the same header.
- MCP tools `run_sql`, `list_tables` and `describe_table` take an optional `branch` argument; `database` stays the parent name.

### Three-way merge

A proposal and a merge both run on a short-lived merge node (`__merge`) with the branch attached next to main. Every table the branch changed is merged against what main did to it since the fork:

| Branch did | Main did | Result |
|---|---|---|
| Changed rows | Nothing, or changed rows | Row merge, cell by cell |
| Created, dropped or recreated the table | Nothing | The table is created, dropped or replaced on main |
| Changed the table's columns | Nothing | Refused, 422 `merge_unsupported` |
| Anything | Changed the table's columns (a rename counts), dropped or recreated it, or created a table of that name | Table conflict, 409 `merge_conflict` |
| Changed the table's columns, dropped or recreated it | Changed rows | Table conflict, 409 `merge_conflict` |

A schema main dropped, views and macros changed on the branch, and a table with a column named `rowid` or `snapshot_id` (rename the column to merge the table) are refused too.

Rows are matched by `rowid`, which the clone keeps and DuckLake preserves on update. For a row that existed at the fork:

| Branch | Main | Result |
|---|---|---|
| Updated | Untouched | The branch's update is applied |
| Updated | Updated | Merged cell by cell: a cell only one side changed takes that side's value; a cell both sides set to different values is a conflict |
| Updated | Deleted | Conflict |
| Deleted | Untouched or deleted | The row is deleted |
| Deleted | Updated | Conflict |

Rows the branch inserted are added to main with new rowids, and main's own inserts stay. With `--key schema.table=col[,col...]` (repeatable) on propose, a branch row whose key equals that of a row main inserted since the fork is a conflict too. A NULL key never matches, and a key naming an unknown table or column, or a table outside the change set, is refused with 400 `invalid_key`.

Any conflict refuses the whole merge and changes nothing, unless the proposal names a winner with `--on-conflict main|branch`. Under `main`, main's value wins in a conflicting cell (the row's other cells still merge), a row main deleted stays deleted, a row main updated stays when the branch deleted it, and a branch row matching a key is dropped. Under `branch`, the branch's value wins in the cell, a row main deleted comes back with the branch's values and a new rowid, a row the branch deleted is deleted, and main's rows matching a key are replaced by the branch's. `--on-conflict` never overrides a table conflict.

A merge names the proposal it approves (`proposalId`, `qod branch merge --proposal <id>`, where the id is `merge.id` in the propose reply), so a proposal replaced after the approver read it is never merged in its place. The merge reads main's head, decides every row again, and applies all tables in one transaction (deletes, then updates, then inserts), retrying up to `mergeMaxAttempts` times while main keeps moving. The commit is stamped with the approver as author and a message naming the branch, the merge id and the proposer; the resulting snapshot is tagged `merge-<branch>-<id>`, and the branch is torn down. With `--hold-writers`, other commits on the merged tables are refused until the merge ends; DuckLake retries them meanwhile, and a writer whose retries run out gets the error.

A merge is refused with:

| Code | Status | When |
|---|---|---|
| `merge_conflict` | 409 | A table conflict, or row conflicts and no `--on-conflict` |
| `conflicts_changed` | 409 | Main made conflicts the proposal did not show: propose again |
| `proposal_stale` | 409 | The branch changed since it was proposed: propose again |
| `proposal_replaced` | 409 | The open proposal is not the one the merge names: read it, then merge it by its id |
| `already_merged` | 409 | The named proposal has merged; the reply names the main snapshot and the tag, which is what a retry after a lost answer reads |
| `proposal_unsettled` | 409 | A merge of this branch may already be on main: merge again, which records it |
| `concurrent_write` | 409 | Main kept moving through every attempt, or `--expect-main` names another snapshot: merge again, or with `--hold-writers` |
| `history_gap` | 409 | A snapshot from the fork on is gone: discard the branch and create it again |
| `admin_required` | 403 | The caller is not a tenant admin |
| `self_merge_forbidden` | 403 | The caller is the proposer |
| `branch_only_token` | 403 | The caller is a PAT minted with `--branch-only` (a merge writes main) |
| `merge_unsupported` | 422 | Column changes on the branch, views or macros, or a reserved column |
| `nothing_to_merge` | 422 | Nothing left to write: discard the branch |

## Keeping agents off main

Mint the agent's personal access token with `--branch-only`:

```bash
qod auth pat create --name agent --branch-only --database acme_tpch
```

`INSERT`, `UPDATE`, `DELETE` and DDL on the live database are then refused with `write_requires_branch`; reads are unchanged, writes on any branch work, and every child token inherits the flag. A branch-only token cannot merge either, not even over REST where the merge endpoint exists: it gets 403 `branch_only_token`. Combined with the absence of a merge tool on MCP, the agent can only ever propose. This gate applies to MCP and REST callers; the raw FlightSQL wire has no token concept.

The branch endpoints (create, changes, propose, merge, discard) act as the caller's own principal. A credential that resolves to no live session or PAT, such as a session that expired mid-request, is refused with 401 before the branch service runs, and a token whose `databases` axis does not name the branch's parent database is refused with 403 `token_scope`.

Change counts run as the requester too (REST `changes`, MCP `branch_changes`), so the node counts only the tables they may read. DuckLake's change feed is what counts them, and it is refused to a user with any column or row policy. A table whose count the node refuses, or whose count fails, carries `countsUnavailable: true`: its zeros are no counts, and the admin UI shows a dash. A proposal's reply counts as the proposer. The summary stored on the merge request is counted by the manager itself, so `show`, propose and merge replies show its per-table counts to superusers only; everyone else, tenant admins included, gets them zeroed and flagged `countsUnavailable`, and asks `changes` for the counts they may read.

## From the CLI

```bash
qod branch create  --tenant acme --db acme_tpch --name feature-x --ttl-hours 24
qod sql --tenant acme --pool bi --branch feature-x "UPDATE nation SET n_comment = 'reviewed' WHERE n_nationkey = 3"
qod branch changes --tenant acme --db acme_tpch --branch feature-x
qod branch diff    --tenant acme --db acme_tpch --branch feature-x --schema main --table nation
qod branch propose --tenant acme --db acme_tpch --branch feature-x --on-conflict main
qod --profile reviewer branch merge --tenant acme --db acme_tpch --branch feature-x --proposal <merge.id>
qod branch list    --tenant acme --db acme_tpch --all
qod branch discard --tenant acme --db acme_tpch --branch feature-x
```

`qod branch show` returns a branch with its merge history; `schema-diff` gives the column-level view of one table. The same operations are on the admin console (the tenant's **Branches** page in the sidebar, see the [admin UI guide](/qod/operating/admin-ui#branches)) and on REST under `/api/branch/*`.

## Configuration

| Key | Default | Env | Meaning |
|---|---|---|---|
| `quack-on-demand.branching.enabled` | `true` | `QOD_BRANCH_ENABLED` | Kill switch for every branch endpoint, tool and the expiry sweep |
| `quack-on-demand.branching.defaultTtlHours` | `168` | `QOD_BRANCH_DEFAULT_TTL_HOURS` | Branch lifetime when the creator sets none; `0` never expires |
| `quack-on-demand.branching.sweepSec` | `300` | `QOD_BRANCH_SWEEP_SEC` | Expiry sweep interval (60s floor) |
| `quack-on-demand.branching.maxPerDatabase` | `20` | `QOD_BRANCH_MAX_PER_DATABASE` | Live branches per database |
| `quack-on-demand.branching.mergeTimeoutSec` | `600` | `QOD_BRANCH_MERGE_TIMEOUT_SEC` | Bounded wait for each stage sent to the merge node, during a merge or a proposal's analysis; a late commit is still detected and recorded |
| `quack-on-demand.branching.mergeMaxAttempts` | `5` | `QOD_BRANCH_MERGE_MAX_ATTEMPTS` | Commit attempts while main keeps changing the merged tables, before 409 `concurrent_write` |
| `quack-on-demand.branching.mergeUpdateChunkRows` | `50000000` | `QOD_BRANCH_MERGE_UPDATE_CHUNK_ROWS` | Rows one UPDATE may carry per table; above it the update splits into rowid ranges inside the same transaction |
| `quack-on-demand.branching.nodeReadyTimeoutSec` | `120` | `QOD_BRANCH_NODE_READY_TIMEOUT_SEC` | Wait for the ephemeral merge node to accept connections |

## Limits

- A branch forks at the parent's current head; a `fromSnapshot` naming another snapshot is refused.
- No branch of a branch, no rebase, no cross-branch queries in one statement.
- Column changes, views and macros on a branch do not merge; apply that DDL on main and use a fresh branch for the data.
- The diff is paginated JSON, not an Arrow stream.
- Audit records every create, propose, merge, discard and expiry (`branch.*` actions); statement history shows branch statements under the branch's pool name.

## Secure in production

- [ ] Keep `QOD_BRANCH_DEFAULT_TTL_HOURS` above `0` (default `168`). A branch with no TTL keeps its node and holds back snapshot expiry above its fork for the whole parent database until someone discards it. A non-admin may ask for at most this default, and with `0` every branch created without a TTL never expires.
- [ ] Set `QOD_BRANCH_MAX_PER_DATABASE` (default `20`) to what you accept: any principal who may connect to a pool of the database can create branches, and each one is a Postgres database and a pool of its own.
- [ ] Set `QOD_BRANCH_ENABLED=false` on a manager that does not use branches.
- [ ] Mint agents' tokens with `qod auth pat create --name <agent> --branch-only --drop-admin --database <db>`: writes on main are refused, the token cannot merge, and it acts as a plain member even when its owner is an admin (see [Keeping agents off main](#keeping-agents-off-main)).
- [ ] Give an agent a token only, never a password: the branch-only restriction binds REST and MCP calls, while the FlightSQL and native DuckDB wires take a password and know nothing of tokens.
- [ ] Merge from a reviewer's own admin account (`qod --profile reviewer branch merge ...`): a merge needs a tenant admin and is refused to the proposer (`self_merge_forbidden`), so an agent's proposal always takes a second person.

See [Security hardening](./hardening.md) for how nodes enforce grants and policies, the same on a branch as on main.
