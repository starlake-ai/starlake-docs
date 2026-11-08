---
id: upgrading-0-12
title: Upgrading to 0.12
description: "The checklists for upgrading a Quack on Demand manager from 0.11.0 to 0.12.0 and from 0.12.0 to 0.12.1, with the requests that are refused from 0.12.1 on."
keywords: ["upgrade", "release notes", "0.12.0", "0.12.1", "migration", "breaking changes"]
---

Coming from 0.11.0, apply [From 0.11.0 to 0.12.0](#from-0110-to-0120) and then [From 0.12.0 to 0.12.1](#from-0120-to-0121). Coming from 0.10.x, start with [Upgrading to 0.11.0](./upgrading.md).

## From 0.12.0 to 0.12.1

### Checklist

**Before upgrading**

1. **Back up the control-plane database.** Liquibase changeset `0057` runs at boot. It makes a change of a database's object-store keys move every tenant's policy version.
2. **Give a login to every database on another Postgres server.** QoD's login is no longer filled in for a metastore that names another server than QoD's own, so a database with no login of its own stops connecting at the next node start or restart. Have a superuser set its `pgUser` and `pgPassword` with `qod database update`, or leave `pgHost` and `pgPort` out to use QoD's server. Hosts are compared as text: with the default `localhost`, a row naming `127.0.0.1` counts as another server. A stored row with whitespace in `pgHost`, `pgPort`, `pgUser`, `dbName` or `schemaName` also counts as another server.
3. **Check every superuser `initSql` that sets `temp_directory`.** See [Spill folders](#spill-folders): a node can now refuse to start where it started before.
4. **Limit keys on shared buckets.** See [Tenants on a shared bucket](#tenants-on-a-shared-bucket).
5. **Rename pools that differ only by `_` and `-`.** See [Node ids and per-pool Secrets](#node-ids-and-per-pool-secrets).
6. **Check `QOD_NODE_BIN`.** `qod-node` now requires `--spill-dir` and `--node-dir` in serve mode, which this release's spawn scripts pass. A `QOD_NODE_BIN` naming an earlier build, or a stale `native/qod-node/build`, fails every spawn with `unknown option '--spill-dir'`. Rebuild it, or unset `QOD_NODE_BIN` to use the bundled binary.
7. **Recompile modules that call `PoolSupervisor.createTenantDb`.** It now states `writerTrusted`. With `false`, it names no server and no path of its own, as a tenant admin.

**While upgrading**

8. Upgrade the node image and the fleet servers with the manager, and restart every node.
9. Under HA on Kubernetes, finish the rolling upgrade before stopping or deleting a pool: a replica still on 0.12.0 removes only the old Secret names.

### Spill folders

A node whose superuser `initSql` sets `temp_directory` now makes a folder of its own under that path, and refuses to start rather than spill elsewhere. The error is `cannot create the spill directory under <folder>: ...`, naming the path at fault. It refuses:

- an existing folder of the path, a symbolic link followed in it, or a folder or link on that link's real path, owned by a user other than root and the node's own. Examples are a group-writable folder shared with colleagues, an NFS export with `root_squash` that shows `nobody`, and a host folder bind-mounted into a rootless container or under `userns-remap`, where a host-root folder also shows `nobody`;
- with a node running as root, a folder of the path owned by any non-root user;
- a path that cannot be created (permission, a read-only filesystem, a component that is a file);
- on Windows, any symbolic link, junction or mounted folder in the path;
- a path holding a line break.

Point `temp_directory` at a folder that root or the node's OS user owns all the way up, or drop the `SET` to keep the default spill folder. See [Temp directory and spilling](./pools-cohorts.md#temp-directory-and-spilling).

### Node ids and per-pool Secrets

A node keeps its stored id across every restart, and a new slot takes the new form, `quack--<tenant>--<db>--<pool>--<index>`, so one pool can show both.

On Kubernetes, a running pod reads its per-pool Secrets under their old names until the manager next starts it, which moves it to the new ones. A container restart does not do that. The old names go once no pod reads them.

Two pools that already read alike come apart at the first boot: a node keeps its stored id, and a pool left with no node row starts in the new form, on the fleet runtime once a server is free. On Kubernetes, a running pod keeps reading the old-named Secrets, which can hold the other pool's values, until the manager next starts it.

Two pools of one database that differ only by `_` and `-` (`eu-west`, `eu_west`) read alike in the new form too, and no restart ends it. On the local and fleet runtimes a fresh slot takes the other's id again, and on Kubernetes each start writes the per-pool Secrets both read. Recreate one under another name, and on Kubernetes then restart the other's nodes.

### Tenants on a shared bucket

A database holding complete keys of its own no longer blocks other tenants' users. Its data folder counts against the users of its own tenant only, for `400 scope_in_data_folder` and for a statement naming a URL there.

On a bucket tenants share, a user's own keys now reach another tenant's folder holding its own keys wherever the store allows them, for reads and writes. The store's key permissions are what protects that folder, so give each tenant keys limited to its own prefix.

### New names

Names that exist keep working, and a manifest import keeps importing them, with one ERROR per name. A fresh node of such a name takes a hashed id. New names follow these rules:

| Name | Rule | Refusal |
|---|---|---|
| Database or pool | May not hold `__` nor start or end with `_` | `400 invalid_name` |
| Pool | 1 to 63 letters, digits, `_` or `-`, starting with a letter, not ending with `-`, holding none of `--`, `_-` or `-_` | `400 invalid_name` |
| Pool | Reads the same as another pool of its database once `_` becomes `-` | `409 pool_reads_alike` |
| Tenant | Letters and digits only, starting with a letter. This applies to a superuser too | `400 invalid_id` |

A metastore `pgUser` or `pgHost` holding whitespace, or a `pgHost` holding any of `? & = #`, is refused on every write, a manifest import included.

### What a tenant admin can no longer do

These writes answer `403 superuser_required` with nothing written. Existing rows are not judged and keep working, and an edit that leaves the value as stored still works.

- Add, change or remove `pgHost`, `pgPort`, `pgUser`, `pgPassword` or `dbName` on a database, on REST or MCP. A password sent counts as a change whatever it says, and rotating the password of a database on another server is a superuser's job. The `dbName` of a `duckdb-file` database stays free.
- Set a `dataPath` other than a remote path (`s3://`, `s3a://`, `r2://`, `gs://`, `az://`, `azure://`, `abfss://`) with complete explicit keys in `objectStore`, or set `metastore.dataPath`. Leave `dataPath` out of a DuckLake database and QoD places it.
- Name a bucket's or a container's root, or a path with a `.` or `..` segment, a glob or an escape in it.
- Change `objectStore`, except on a database holding complete keys of its own, which stay complete. Any change to them needs the scheme's secret sent in the same request.
- Change the `connection` or `config` of a federated source holding a secret, or make a read-only one holding a secret writable. A superuser makes the change, or delete the source and create it again with its secrets.

`GET /api/database/metastore-defaults` and MCP `metastore_defaults` now answer only a superuser.

A tenant admin's `database/create` on QoD's server no longer takes over a Postgres database holding anything: it answers `409 database_name_taken`, and an empty one is reused. A named remote path at, under or above a folder the location rules deny answers `409 data_path_taken`.

### Postgres servers other than QoD's

- `database/create` and `database/update` answer `400 own_login_required` to a superuser's metastore whose `pgHost` or `pgPort` differ from the default's without its own `pgUser` and `pgPassword`. A stored password does not follow a change of host or port: send it again.
- QoD creates and drops no Postgres database on another server. The catalog database must exist first (`400 catalog_database_missing` names it), `database/delete` and a tenant delete leave it, logged at ERROR, and the database cannot be branched (`400 branch_own_server`).
- `database/delete` and a tenant delete drop a Postgres database only for a DuckLake row.

### What only a superuser now sees

`/api/pool/list`, `GET /api/pool/{tenant}/{tenantDb}/{pool}/status`, `/api/database/list`, the answers of `database create` and `update`, and MCP `get_pool_status`, `list_pools` and `list_databases` show anyone else no `pgHost`, `pgPort` or `pgUser` of a database on QoD's server, and nothing else the manager's defaults filled in, such as an inherited `schemaName`. A database on another server still shows its own.

### Other changes

- A DuckLake create naming no path no longer answers `400`: the database gets a folder of its own beside the default data path. With no default data path, or one that is a bucket's root, it answers `400 invalid_contract`.
- A node's `quack_azure` secret, the manager's `QOD_AZURE_CONNECTION_STRING`, exists only for a database with no `objectStore`, and is scoped to its data path and its branches' prefix. A superuser reading any other `az://` path creates a secret of their own.

## From 0.11.0 to 0.12.0

**Before upgrading**

1. **Back up the control-plane database.** Liquibase changeset `0056` runs at boot and adds the columns of a three-way merge to `qodstate_branch_merge`.
2. **On Kubernetes, read your maintenance policies.** No maintenance node had ever started on a real cluster, so a database with maintenance enabled runs it for the first time after this upgrade. Its first runs do all the snapshot expiry, compaction and file cleanup that never ran.
3. **On an OPA tenant, read any rule keyed on columns.** A branch's change count now reads rowids only, so OPA is asked about that statement with `columns: []`, and a rule that refuses by column no longer refuses a count. To keep counts from a user, refuse on the table.

**After upgrading**

4. Propose open branch merges again. A proposal from before the upgrade is refused `409 proposal_stale` on merge.
5. Under HA, finish the rolling upgrade before merging a branch: a replica still on 0.11.0 serves its fast-forward merge on a row a new replica proposed.

### Branch merges

- `POST /api/branch/merge` requires `proposalId` and `qod branch merge` requires `--proposal`. The approver names the proposal they read, and another one in its place is `409 proposal_replaced`. One that has already merged is `409 already_merged`, naming the main snapshot and the tag.
- A merge refuses `409 proposal_stale` when the branch moved since the proposal, where it used to take the newer head. Proposing a branch that is already proposed replaces its open proposal, and `409 already_proposed` is gone.
- A table with a column named `snapshot_id` no longer merges (`422 merge_unsupported`): rename the column.
