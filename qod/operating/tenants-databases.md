---
id: tenants-databases
title: Tenants and databases
description: "Provision tenants and their databases on a DuckDB gateway, the object hierarchy behind them, and per-database object store credentials."
keywords: ["tenants", "databases", "provisioning", "multi-tenant duckdb"]
---

This page covers provisioning the two structural objects every deployment starts with: tenants and their databases (tenant-dbs). Pools are layered on top of a database; see the "Pools and cohorts" page. For how these objects relate to access control, see the [Access control model](/qod/operating/rbac-model).

## The object hierarchy

```
tenant  ──owns──▶  tenant-db (a database)  ──hosts──▶  pool  ──contains──▶  nodes
```

- A **tenant** is an isolation boundary. It owns one or more databases and selects the auth provider for its users.
- A **tenant-db** is a database. In the default `ducklake` kind it is a Postgres database on the shared server, holding a DuckLake catalog with a catalog name and a default schema.
- A **pool** is bound to exactly one tenant-db and is what clients connect to.

Provision them in that order: tenant first, then a database under it, then a pool under the database.

## Authenticating with the CLI

Every `/api/*` call needs a credential. The examples below use the [qod CLI](/qod/cli/); they assume `qod login` has stored a session, or `QOD_TOKEN` holds a personal access token for CI scripts.

## Tenants

### Create a tenant

```bash
qod tenant create acme
```

`--auth-provider` defaults to `db` (database-backed bcrypt users). To point a tenant's users at an OIDC provider instead, set `--auth-provider` to one of `keycloak` / `google` / `azure` / `aws` and supply the provider config with repeatable `--auth-config KEY=VALUE`:

```bash
qod tenant create acme --auth-provider keycloak \
  --auth-config issuerUrl=https://kc.example.com/realms/acme --auth-config clientId=qod-acme \
  --auth-config baseUrl=https://kc.example.com --auth-config realm=acme
```

`authConfig` is empty for `db`. For OIDC providers two things read it, each with the keys it needs:

- The admin-console sign-in reads `issuerUrl` (the OIDC discovery base), `clientId` and an optional `scopes`, plus a client secret that is kept outside `authConfig`: set it with `qod tenant set-auth ... --client-secret-prompt` (that command replaces the whole `authConfig`, so repeat the keys above; a superuser may use `clientSecretRef` instead). The tenant's console sign-in is on once `issuerUrl`, `clientId` and a secret are all set.
- FlightSQL bearer validation reads `clientId` plus the provider's own fields: `baseUrl` and `realm` (Keycloak), `tenantId` (Azure AD), `region` and `userPoolId` (Cognito). Google needs only `clientId`. A tenant that sets all of its provider's fields gets its own OAuth client, whose `clientId` is the audience of its tokens, instead of sharing the manager-wide one from `quack-flightsql.auth.<provider>.*`; a missing field falls back to the global client.

See [Per-tenant OIDC](./auth-providers.md#per-tenant-oidc) for the console sign-in and [Authentication providers](./auth-providers.md#per-tenant-google-oauth-clients) for the bearer override.

### List, disable, change auth, delete

```bash
# List every tenant (with its pools and auth provider)
qod tenant list

# Disable a tenant: the edge rejects fresh handshakes for all its pools
qod tenant set-disabled acme --disabled

# Switch the auth provider after creation
qod tenant set-auth acme --auth-provider db

# Delete a tenant (remove its pools first, else 409 has_pools)
qod tenant delete acme
```

### Authorized folders and users' own S3 keys

A tenant user reads or writes a file by path only through a file reader (`read_parquet`, `read_csv`, ...) or `COPY`, and only where it is theirs to reach. The node resolves the path and refuses anything else (`QoD: <url> is outside the tenant's authorized locations`). Superusers are not limited by these rules.

- **Local folders** the tenant authorized. A superuser or one of the tenant's admins adds an absolute folder under `<QOD_TENANT_FILES_ROOT>/<tenant id>/`; with `QOD_TENANT_FILES_ROOT` unset (the default) no local folder can be authorized. Nodes on Windows admit no local folder.

  ```bash
  qod tenant location add acme /srv/qod-files/acme/incoming/
  qod tenant location list acme
  qod tenant location remove acme <id from list>
  ```

  Refusals: `400 invalid_location` (an `s3://` location, a relative path, an empty, `.` or `..` segment, `%`, a glob character or a backslash), `400 outside_tenant_files_root`, `400 tenant_files_root_unset`, `409 location_exists`. REST: `POST /api/tenant/location/{list,add,remove}`; the admin UI lists them on the tenant's **Access Control** page.
- **`s3://` scopes the user holds keys for.** S3 is per user, never per tenant: each user registers keys of their own for a bucket or a prefix, and the node signs that user's requests with them only. A tenant admin lists and removes their users' keys (`qod user s3 list|remove`, the user's row in the admin UI) but never adds one.

  ```bash
  # The secret comes from stdin (or --secret-prompt), never from the command line
  qod profile s3 add s3://acme-etl/ --access-key-id AKIA... --secret-stdin --region eu-west-3 < key.secret
  qod profile s3 list
  qod profile s3 remove <id from list>
  ```

  `--session-token-stdin` / `--session-token-prompt` add temporary credentials; `--endpoint host[:port]` (`http://` for plain HTTP) and `--url-style path|vhost` target an S3-compatible store, which the operator must list in `QOD_USER_S3_ALLOWED_ENDPOINTS` (empty: AWS only). A scope already held is replaced. Refusals: `400 invalid_scope`, `400 credential_required`, `400 invalid_credential`, `400 invalid_endpoint`, `400 endpoint_not_allowed`, `400 scope_in_data_folder`, `400 too_many_credentials` (32 per user). REST: `POST /api/profile/s3/{list,add,remove}` for the user, `POST /api/user/s3/{list,remove}` for an admin. The secrets are write-only and never in a manifest.

A database's data folder, any tenant's, is never reachable by its path (`QoD: <path> is a database data folder`). Users' keys are stored in plaintext in the control-plane database and travel to the nodes signed but not encrypted: protect the control-plane backups accordingly and keep manager-to-node traffic on a private network. Keep tenant folders free of symbolic links (copy files in with `rsync -rt`, not `rsync -a`): a link below an authorized folder can lead out of it through a glob or a `COPY` with `PARTITION_BY`, `PER_THREAD_OUTPUT` or `OVERWRITE`, into any tenant's data folder.

## Databases (tenant-dbs)

A database is created under an existing tenant. The `name` you pass is a suffix; the manager composes the real Postgres database name as `${tenant}_${suffix}` and provisions that database on the shared server. For example, `tenant=acme`, `name=sales` yields the database `acme_sales`.

### Create a database

```bash
qod database create --tenant acme --name sales --kind ducklake \
  --data-path /app/ducklake/acme_sales --default-schema mart
```

| Field | Meaning |
|---|---|
| `tenant` | Owning tenant (must exist). |
| `name` | Database suffix; the full name becomes `${tenant}_${name}`. |
| `kind` | `ducklake` (DuckLake catalog backed by Postgres, the default), `duckdb-file` (a standalone `.duckdb` file), or `memory` (no persistent catalog; useful for federation-only databases). |
| `dataPath` | Where DuckLake writes Parquet. A filesystem path, or an `s3://` / `az://` / `abfss://` URI for object storage. A `ducklake` create that names none gets a folder of its own beside the default data path (`QOD_DUCKLAKE_DATA_PATH`), under the database's full name, stored on the database: `400 invalid_contract` when there is no default to place it by, `409 data_path_taken` when another database's folder overlaps it. A caller who is not a superuser names no other path than a folder of a remote store (`s3://`, `s3a://`, `r2://`, `gs://`, `az://`, `azure://`, `abfss://`), not its root, with their own keys in `objectStore`, complete for its scheme; anything else is `403 superuser_required`, and a folder at, under or above another database's is `409 data_path_taken`. `managedStorage` is the other way to get one. |
| `metastore` | Optional per-database overrides of the Postgres connection (`pgHost`, `pgPort`, `pgUser`, `pgPassword`, `dbName`, `schemaName`). Keys left out take the manager's defaults, but the default login (`pgUser`, `pgPassword`) fills in only on QoD's own Postgres server: a `ducklake` database on another server brings its own, else `400 own_login_required`. Only a superuser sets `pgHost`, `pgPort`, `pgUser`, `pgPassword` or `dbName` (`dbName` stays free on `kind=duckdb-file`); anyone else gets `403 superuser_required`. |
| `objectStore` | Optional per-database object-store credentials when `dataPath` is an object-store URI. Takes effect at node spawn as a path-scoped DuckDB secret; see below. |
| `defaultDatabase` / `defaultSchema` | The catalog and schema unqualified table names resolve against for sessions on this database. `defaultSchema` must differ from the database name to avoid ambiguous two-part identifiers in DuckDB. |

### Per-database object-store credentials

`objectStore` authenticates this database's own bucket, separately from the manager-wide `QOD_S3_*` / `QOD_AZURE_*` / `QOD_GCS_*` defaults. Setting it (via `qod database create --object-store KEY=VALUE` / `--object-store` on update, or the object-store fields in the admin UI's database edit form) authors a `CREATE SECRET` scoped to that database's `dataPath`, so this database's bucket authenticates with its own keys. Leaving `objectStore` empty falls back to the global env credentials, also scoped to the database's own data path: neither set signs a request outside it, so a statement that reads another bucket uses the reading user's own keys (see [Authorized folders and users' own S3 keys](#authorized-folders-and-users-own-s3-keys)).

Provider-specific keys, matched by the `dataPath` scheme:

| Provider | `dataPath` scheme | Keys |
|---|---|---|
| S3 / R2 | `s3://`, `s3a://`, `r2://` | `s3_region`, `s3_access_key_id`, `s3_secret_access_key`, `s3_endpoint`, `s3_url_style` |
| GCS (HMAC) | `gs://` | `gcs_hmac_key_id`, `gcs_hmac_secret` |
| Azure | `az://`, `azure://`, `abfss://` | `azure_account`, `azure_account_key` |

The credentials never appear in a node's environment or command line: on Kubernetes the manager writes them into a per-node Secret (`qod-store-${nodeId}`) mounted as a file of the pod's read-only secrets volume, mirroring the per-pod token and federation secrets; on the local and fleet backends they arrive as owner-only files in a private secrets directory deleted right after the node reads them. GET/list responses redact the secret-valued keys (`s3_secret_access_key`, `azure_account_key`, `gcs_hmac_secret`, alongside `pgPassword`).

This per-db secret is authored only for `kind=ducklake` databases (both spawn scripts install it right before the DuckLake `ATTACH`). A `duckdb-file` database does not get a per-db object-store secret even when its `dataPath` is a remote URI - that spawn arm does not install `httpfs`/`azure` at all today, so a remote `duckdb-file` dataPath is not a supported combination yet, independent of this feature.

Editing `objectStore` (create or update) restarts the database's nodes so the new secret takes effect immediately; edits do not rotate a secret on an already-running node without a respawn. For object storage on S3-compatible backends and the manager-wide `QOD_S3_*` keys, see the Docker deployment page and the [Configuration reference](/qod/reference/configuration).

### Managed object storage

The alternative to bringing your own bucket: with `quack-on-demand.managedObjectStore` enabled, `qod database create --managed-storage` (or `managedStorage: true`, or the storage mode "Managed (QoD-provisioned)" in the admin UI) lets the manager carve this database's `dataPath` out of one operator root bucket and fill its `objectStore` for you. `managedStorage` is exclusive with `dataPath` and `objectStore`, requires `kind=ducklake`, and is refused while the config block is off. Deleting such a database tombstones its prefix and a background worker purges the objects after a retention window. See [Managed object storage](/qod/operating/managed-storage).

### Encryption at rest

`qod database create --encrypted` stores this database's data encrypted on disk: Parquet files for
a `ducklake` database, the file itself for a `duckdb-file` database. It is chosen at create time
and cannot be changed later in either direction, so decide before you create. `kind=memory` cannot
be encrypted. See [Encryption at rest](/qod/operating/encryption).

### Init SQL trust

A database's `initSql` (and a pool's, `qod pool set-init-sql`) is SQL each node runs at start. Who wrote it decides how it runs:

- written by a superuser, or by the manager itself (`qod serve`, a manifest import, a branch copying its parent): runs as written;
- written by a tenant admin: runs statement by statement under an allowlist, and every other statement is skipped (the node log names its position, never its text). The allowlist is `SET` / `RESET` to a literal of `calendar`, `checkpoint_threshold`, `default_collation`, `default_null_order`, `default_order`, `errors_as_json`, `max_memory`, `max_temp_directory_size`, `memory_limit`, `ordered_aggregate_threshold`, `preserve_insertion_order`, `threads`, `timezone`, `wal_autocheckpoint`, `worker_threads`; a read-only `PRAGMA` with literal arguments; and `INSTALL` / `LOAD` by bare name of `avro`, `aws`, `azure`, `delta`, `ducklake`, `encodings`, `excel`, `fts`, `httpfs`, `iceberg`, `icu`, `inet`, `json`, `mysql_scanner`, `parquet`, `postgres_scanner`, `spatial`, `sqlite_scanner`, `tpcds`, `tpch`, `vss`.

A tenant admin's write holding anything else is refused up front with `400 init_sql_refused`, naming each refused statement's position and reason. Where the manager has no local node binary to check with (Kubernetes, or fleet without `QOD_FLEET_EPHEMERAL=local`), the write is accepted and the response carries an `initSqlWarning`. A tenant admin's text holds at most 64 KiB, and no initSql may contain `qod:untrusted-`. Database and pool responses carry `initSqlTrusted`, and so do manifests.

```bash
# A superuser re-saving a text unchanged trusts it again (restart the nodes afterwards)
qod database update --tenant acme --name acme_tpch --init-sql "SET memory_limit = '8GB';"
qod pool set-init-sql --tenant acme --db acme_tpch --pool bi --init-sql "SET threads = 4;"
```

Upgrading to 0.11.0 marks every non-empty initSql not written by `qod serve` untrusted, and boot WARNs once per database or pool that would lose statements; see [Upgrading to 0.11.0](./upgrading.md).

### List and delete

```bash
# List the databases under a tenant
qod database list --tenant acme

# Delete a database (remove its pools first, else 409 has_pools)
qod database delete --tenant acme --name sales
```

Deleting a database removes the `qodstate_tenant_db` row. For a `ducklake` database it also drops the catalog's Postgres database when that lies on QoD's own server; on another server it drops nothing and logs an ERROR naming the database to drop there by hand. The data files are left in place: reclaim them separately if you no longer need the data. The exception is a database on [managed object storage](/qod/operating/managed-storage), whose data QoD does reclaim: delete tombstones the prefix and a background worker purges the objects once the retention window elapses, or right away with `--purge-managed-data`.

## Secure in production

- [ ] Set `QOD_PG_USER` / `QOD_PG_PASSWORD` to a non-superuser Postgres role with `CREATEDB` (the defaults are `postgres` / `azizam`): every database on QoD's own Postgres server, and the nodes that serve it, use this login.
- [ ] Point a database's `metastore` at another Postgres server only when you trust that server as far as the database's nodes: whoever controls it reaches what those nodes reach. Such a database needs its own `pgUser` and `pgPassword` (`400 own_login_required`), and only a superuser sets the server keys (`403 superuser_required`).
- [ ] Leave `QOD_TENANT_FILES_ROOT` unset unless users must load local files; when you set it, keep the tenant folders free of symbolic links (see [Authorized folders and users' own S3 keys](#authorized-folders-and-users-own-s3-keys)).
- [ ] List in `QOD_USER_S3_ALLOWED_ENDPOINTS` only the S3-compatible endpoints you trust users to send their own keys to (empty, the default, means AWS only).
- [ ] Set `QOD_NODE_ALLOW_LOCAL_FILES=false` when every database's data lies on object storage (on Kubernetes, in the chart's `env`): nodes then open no local file for anyone, from their next start. A database whose data path is local is blocked, and boot refuses the setting together with `QOD_TENANT_FILES_ROOT`.
- [ ] On Kubernetes, and on fleet without `QOD_FLEET_EPHEMERAL=local`, read every tenant admin's `initSql` whose save answered with `initSqlWarning`: it was not checked against the allowlist, and a superuser who re-saves it unchanged makes it trusted (see [Init SQL trust](#init-sql-trust)).
- [ ] When a tenant's data must be gone, remove its data folder yourself: deleting a DuckLake database drops its catalog database only when it lies on QoD's own Postgres server, and leaves its data files in place (managed storage excepted).

See [Security hardening](./hardening.md#files-and-s3) for how nodes judge file paths and S3 scopes, and why users' S3 keys make control-plane backups sensitive.

## Next step

With a tenant and a database in place, create a pool of nodes against that database so clients can connect and query. See the "Pools and cohorts" page.
