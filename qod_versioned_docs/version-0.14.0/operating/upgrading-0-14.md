---
id: upgrading-0-14
title: Upgrading to 0.14
description: "The checklist for upgrading a QoD manager from 0.13.x to 0.14.0: restart every node, and from this release on the manager checks the upgrade path at boot."
keywords: ["upgrade", "release notes", "0.14.0", "0.13.1", "release gate", "migration", "rollback"]
---

Coming from 0.12.x or earlier, first apply [Upgrading to 0.13](./upgrading-0-13.md).

## From 0.13.0 to 0.13.1

1. **Check the maintenance timeout.** `QOD_MAINT_RUN_TIMEOUT_MIN` now caps a maintenance run's whole chain, from its start, the wait for its database's lock included, and the replica running it stops its node when the cap is reached, on a single manager too. Before, it only bounded the time between two steps. Its default rises from 60 to 240 minutes. Set it above the longest full maintenance chain of your largest database.
2. **Clear a `defaultDatabase` that names another catalog.** A database's `defaultDatabase` may only name the database's own catalog (its `catalogAlias`, else its `dbName`, else its name; `memory` for `kind=memory`), where its nodes resolve unqualified table names. `database/create` and `database/update` refuse any other value with `400 default_database_mismatch`. A database stored with another value keeps working: the value is ignored, a manifest export leaves it out, and each boot prints one `WARN:` line for it. Clear it with `qod database update --default-database ''`. A `memory` database that pointed `defaultDatabase` at a federated alias names that catalog's tables by their alias (`fedpg.public.orders`).
3. **Under HA**, during a rolling upgrade a maintenance run still executing on a replica of 0.13.0 can be failed as `stale` by an upgraded leader. No node is stopped for it, and the next cadence or threshold tick queues the run again.

## From 0.13.x to 0.14.0

0.14.0 upgrades directly from 0.10.0 or later, and rolls back to 0.13.1 without a restore of the control-plane database.

### Checklist

**While upgrading**

1. **Upgrade the node image and the fleet servers with the manager.**

**After upgrading**

2. **Restart every node.** Until a node restarts, each real authorization outage on it reads as a permanent denial instead of a retryable `UNAVAILABLE`. See [Authorization outages](#authorization-outages).
3. **Tell users of row and column policies what changed for them.** See [What changes for clients](#what-changes-for-clients).

### The release gate

From 0.14.0, each release states its upgrade path, and the manager checks it at boot. The release notes open with an *Upgrading* block, and the release's `release.json` carries the same fields:

- `min_from_version`: the oldest release that upgrades directly to this one, applying the steps of every release after it, in order.
- The manual steps of every release after it, each marked before, during or after the upgrade.
- `rollback_without_restore`: whether the previous release boots on the schema this one leaves, and if not, what makes the rollback one way.

Liquibase changeset `0059` adds the `qodstate_release` table, where each manager records its release once the schema is applied. At boot, a manager refuses a control plane last run by a release older than its `min_from_version`, naming the release to go through first, and refuses a schema that a newer release changed one way, naming the changesets it does not know and the restore to run. Only releases from 0.14.0 on check: 0.13.x booted on a newer schema fails as before.

### Authorization outages

A node's refusal can quote text from the statement after `QoD: `, so a statement could once be refused with a message that read like an outage (`authorization unavailable, retry`) and escape the denial audit. A 0.14.0 node now ends a real outage with a marker bound to the statement's session handle and the node's key, and the manager treats the text as an outage only when that marker verifies. Anything else is a denial: Flight `UNAUTHORIZED`, history status `denied` and a `data-denial` audit event.

A node of an earlier release sends no marker, which is why every node must restart.

Two refusals that were retryable outages are now denials:

- An authorization request larger than the verdict listener takes (1 MiB).
- A request the verdict listener refuses as malformed (`400`).

See [Day-2 operations](../administration/day-2-operations.md) for the errors a client can see.

### What changes for clients

- **Stopping the manager lets its running statements finish.** `qod stop`, Ctrl-C or SIGTERM signal the manager alone. Its FlightSQL edge refuses new calls, lets running ones finish for up to `QOD_DRAIN_TIMEOUT_SEC` (60 s), then the manager stops its nodes, so a stop can take up to the drain plus 20 s. The native Quack front door (`:9494`) still closes its sessions when the drain starts. Under systemd, see `TimeoutStopSec` in [Deploy on a single server](./deploy-single-server.md#03-run-the-manager-under-systemd).
- **Row policies and time travel.** A user with a row policy on a table now reads it at the snapshot its `AT (...)` clause names, filtered. Before, the clause was dropped and the statement read the current snapshot with no error. A time-travel read under a column or row policy is refused when the table, under that name, has not always been the same table with the same column names.
- **Row policies and samples or pivots.** The same user is refused `TABLESAMPLE`, `USING SAMPLE`, or a `PIVOT` / `UNPIVOT` written after the table, which used to return every filtered row unsampled. Wrap the table in a subquery: `FROM (SELECT * FROM customer) USING SAMPLE 10%`. Users without row policies are not affected. See [Access control model](./rbac-model.md).
- **Personal access tokens.** Minting a token whose `tools` list names a tool that does not exist answers `400 unknown_tool`. Tokens already minted are not checked again. `qod auth pat tools` lists the valid names.
- **REST paths.** A request path holding a `.` or `..` segment answers `404` on every API route.
- **Error text.** A client's error no longer names a node's address; the manager log keeps it.

### New in 0.14.0

- A read-only REST data edge serves tables and views as HTTP resources, off by default: see [REST data edge](../connecting/rest-data-edge.md).
- One Linux host can keep several releases installed and switch between them offline: see [Deploy on a single server](./deploy-single-server.md).
- The Docker images check the sha256 of every DuckDB archive they download.
