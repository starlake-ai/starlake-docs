---
id: branching
title: Branching (agents propose, humans merge)
description: "Zero-copy branches of a DuckLake database: agents and pipelines write on a branch, humans review the row-level diff and merge into main."
keywords: ["ducklake branching", "zero-copy branch", "data branching", "agents"]
---

A branch is a writable, zero-copy clone of a DuckLake database at its current head. Agents and pipelines write on the branch, a human reviews the change set and the row-level diff, then merges it into main in one stamped, tagged snapshot. Reads and writes on a branch never touch the live database, and a branch-only token makes writing main impossible for the agent that holds it.

Branching applies to `ducklake` databases only, and a branch cannot itself be branched.

## How a branch is built

Creating a branch clones the database's DuckLake catalog at the Postgres level: every `ducklake_*` metadata table is copied into a new database under one repeatable-read transaction, so the copy is a consistent snapshot even while the parent is being written. No Parquet is copied. The clone's file references are rewritten to the parent's absolute locations, and its data path points at a sibling prefix, `<parent prefix>__br_<id>/`, so new files written on the branch land there and nowhere else.

The clone is registered as a tenant-db of its own (`<parent>__br_<id>`), served by one pool (`__br_<id>`, a single dual node) that attaches the catalog under the **parent's** catalog name. That is what makes a branch transparent to clients: the same SQL, grants, row and column policies, and unqualified table names apply on the branch exactly as they do on main. The branch pool inherits the parent's pool sizing, lockdown and idle-hibernation settings, so an idle branch scales to zero and wakes on its next statement.

The fork snapshot is recorded per branch and pinned: [managed maintenance](/qod/operating/maintenance) on the parent never expires it, so the files the branch reads in place stay put. Branch catalogs are never maintained themselves, and a database with live branches cannot be deleted.

## Lifecycle

| Step | Who | What happens |
|---|---|---|
| create | anyone who can connect to a pool of the database | Clone at head, start the branch pool, start the TTL |
| write | the same principal, targeting the branch | Ordinary SQL through FlightSQL or MCP; ACL, RLS and CLS apply |
| changes and diff | anyone with access | Touched tables classified as created, dropped, recreated, modified or altered, with row counts; conflicts against main; row-level diff per table |
| propose | the branch owner or any principal with access | Records a merge request carrying the change set and conflicts as of now |
| merge | a tenant admin **other than the proposer** | Fast-forward onto main, one snapshot, tagged, branch torn down |
| discard | the owner or a tenant admin | Pool, catalog and branch-only files freed; the row stays as history |
| expiry | the manager | Live branches past their TTL are discarded by a leader-gated sweep |

Branch names are lowercase: a letter first, then letters, digits, `_` or `-`, at most 48 characters. A name is free again once the branch is merged, discarded or expired.

### Targeting a branch

- FlightSQL and ADBC clients add a `branch=<name>` connection header next to `tenant` and `pool` (the Arrow Flight JDBC URL form is `?tenant=acme&pool=bi&branch=feature-x`). Authorization runs against the named parent pool; only the routing target is swapped to the branch's pool.
- `qod sql --branch feature-x ...` sends the same header.
- MCP tools `run_sql`, `list_tables` and `describe_table` take an optional `branch` argument; `database` stays the parent name.

### Merge semantics (fast-forward only)

The change set is recomputed at merge time. A merge is refused when:

- main touched any table the branch touched since the fork, or dropped a schema holding one (409 `merge_conflict`, listing the tables);
- the branch altered a table's columns, or touched views or macros (422 `merge_unsupported`; v1 merges created, dropped, recreated and data-modified tables);
- the caller is the proposer (403 `self_merge_forbidden`);
- `expectedMainSnapshot` was given and main moved past it (409 `concurrent_write`).

Otherwise the manager spawns a short-lived merge node with the branch attached read-only next to main and runs one transaction: created tables are copied with `CREATE TABLE AS`, dropped tables dropped, and for modified tables the rows the branch deleted or updated are removed by row id and the current branch rows for every inserted or updated row id are inserted. Row ids are stable across the clone and preserved by DuckLake on update, which is what makes the replay exact for every interleaving. The commit is stamped with the approver as author and a message naming the branch, the merge id and the proposer; the resulting snapshot is tagged `merge-<branch>-<id>`.

A merge that loses a DuckLake commit race to a concurrent writer answers 409 `concurrent_write`, marks the merge request failed and reopens the branch: propose again to retry.

## Keeping agents off main

Mint the agent's personal access token with `--branch-only`:

```bash
qod auth pat create --name agent --branch-only --database acme_tpch
```

`INSERT`, `UPDATE`, `DELETE` and DDL on the live database are then refused with `write_requires_branch`; reads are unchanged, writes on any branch work, and every child token inherits the flag. Combined with the absence of a merge tool on MCP, the agent can only ever propose. This gate applies to MCP and REST callers; the raw FlightSQL wire has no token concept.

## From the CLI

```bash
qod branch create  --tenant acme --db acme_tpch --name feature-x --ttl-hours 24
qod sql --tenant acme --pool bi --branch feature-x "UPDATE nation SET n_comment = 'reviewed' WHERE n_nationkey = 3"
qod branch changes --tenant acme --db acme_tpch --branch feature-x
qod branch diff    --tenant acme --db acme_tpch --branch feature-x --schema main --table nation
qod branch propose --tenant acme --db acme_tpch --branch feature-x
qod --profile reviewer branch merge --tenant acme --db acme_tpch --branch feature-x
qod branch list    --tenant acme --db acme_tpch --all
qod branch discard --tenant acme --db acme_tpch --branch feature-x
```

`qod branch show` returns a branch with its merge history; `schema-diff` gives the column-level view of one table. The same operations are on the admin console (tenant page, Branches tab, see the [admin UI guide](/qod/operating/admin-ui#branches)) and on REST under `/api/branch/*`.

## Configuration

| Key | Default | Env | Meaning |
|---|---|---|---|
| `quack-on-demand.branching.enabled` | `true` | `QOD_BRANCH_ENABLED` | Kill switch for every branch endpoint, tool and the expiry sweep |
| `quack-on-demand.branching.defaultTtlHours` | `168` | `QOD_BRANCH_DEFAULT_TTL_HOURS` | Branch lifetime when the creator sets none; `0` never expires |
| `quack-on-demand.branching.sweepSec` | `300` | `QOD_BRANCH_SWEEP_SEC` | Expiry sweep interval (60s floor) |
| `quack-on-demand.branching.maxPerDatabase` | `20` | `QOD_BRANCH_MAX_PER_DATABASE` | Live branches per database |
| `quack-on-demand.branching.mergeTimeoutSec` | `600` | `QOD_BRANCH_MERGE_TIMEOUT_SEC` | Bounded wait for the merge transaction; a late commit is still detected and recorded |
| `quack-on-demand.branching.nodeReadyTimeoutSec` | `120` | `QOD_BRANCH_NODE_READY_TIMEOUT_SEC` | Wait for the ephemeral merge node to accept connections |

## Limits in v1

- Branches fork at the parent's current head; `fromSnapshot` on create is reserved and refused otherwise.
- No branch of a branch, no three-way merge or rebase, no cross-branch queries in one statement.
- Column changes, views and macros on a branch do not merge; apply that DDL on main and use a fresh branch for the data.
- The diff is paginated JSON, not an Arrow stream.
- Audit records every create, propose, merge, discard and expiry (`branch.*` actions); statement history shows branch statements under the branch's pool name.
