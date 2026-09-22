---
id: encryption
title: Encryption at rest
---

A database can be created with its data encrypted on disk. The mechanism differs by database
kind, but the switch is the same one: `encrypted` at create time.

This is encryption **at rest**, protecting the bytes in your object store or on your disk. For
encryption **in transit** on the FlightSQL edge, see [TLS](tls.md).

## What it protects, and what it does not

Encryption at rest moves the trust boundary to the control plane. It makes your object store or
disk an untrusted location: someone who copies your Parquet files or your `.duckdb` file cannot
read them.

It does not protect against someone who can read the control-plane Postgres database. For a
DuckLake database, the per-file keys live in that database. For a DuckDB file database, the key
lives there too. **Whoever can read the control plane can decrypt the data**, and no design at this
layer changes that. Protect the control-plane database accordingly: volume-level encryption,
restricted network access, and tight grants on the `qodstate_*` tables.

## Turning it on

Encryption is chosen when the database is created and **cannot be changed afterwards**, in either
direction. Neither DuckDB nor DuckLake can encrypt, decrypt or re-key an existing database in
place. To change it, create a new database and copy the data.

```bash
qod database create --tenant acme --name lake --encrypted
```

In the admin UI, tick "Encrypt at rest" on the database-create form. Over REST, pass
`"encrypted": true` to `database/create`.

## How each kind is encrypted

### DuckLake databases

Every Parquet file the database writes is encrypted. DuckLake generates a fresh key per file at
write time and stores it in the database's own catalog; reads fetch the key and decrypt
transparently. Queries look exactly as they do on an unencrypted database.

You supply no key and manage no key. Supplying one is refused, because DuckLake mints its own.

### DuckDB file databases

The `.duckdb` file is encrypted with a single key, using AES-256-GCM. The write-ahead log and
temporary files are encrypted along with it.

Omit `--encryption-key` and the manager generates a key for you. Supply one and it is used as
given:

```bash
qod database create --tenant acme --name sales --kind duckdb-file \
  --data-path /var/lib/qod/sales.duckdb --encrypted \
  --encryption-key "$(openssl rand -base64 32)"
```

**A supplied key is never readable back through any API.** If you supply one and lose it, the
database cannot be opened again. Unless you have a reason to hold the key yourself, let the
manager generate it.

### In-memory databases

Refused. An in-memory database stores nothing at rest, so the flag would be meaningless.

## Requiring encryption deployment-wide

Set `QOD_REQUIRE_ENCRYPTION=true` (`quack-on-demand.requireEncryption`) and the manager refuses to
create an unencrypted database, over REST and through
[manifest import](manifest.md) alike. `kind=memory` is refused outright while the policy is on.

The policy gates **creation only**. Databases that already exist are untouched, so turning it on
never breaks a running deployment. It guarantees that no new plaintext database can be created,
not that none exists: to get the stronger property, turn it on before you create anything.

## What else inherits it

- **Branches.** A [branch](branching.md) of an encrypted database is encrypted, and one of an
  unencrypted database is not. The branch clones its parent's catalog, so the setting comes with
  it. You cannot flip it on a branch.
- **Manifests.** The `encrypted` flag round-trips through
  [manifest export and import](manifest.md). The encryption key does **not**: it is redacted on
  export, so an exported manifest cannot recreate an encrypted DuckDB file database elsewhere.
  That is deliberate, since the key must not leave the control plane. Re-applying a manifest to
  the same deployment is unaffected, because the stored key is carried forward.

## Kubernetes

Node credentials reach a pod through a per-pool Kubernetes Secret rather than the pod's plain
environment, so they no longer appear in `kubectl get pod -o yaml`. This covers the encryption key
and the control-plane password, the latter because it opens the catalog holding a DuckLake
database's per-file keys.

**When upgrading:** pods created by an earlier manager keep the old shape and are not migrated in
place. Restart every node after upgrading, for example by scaling each pool down and back up.

## Verifying it worked

For a DuckLake database, the catalog records the setting. Reading a data file directly, without
the catalog, fails:

```
Invalid Input Error: File '...' is encrypted, but 'encryption_config' was not set
```

For a DuckDB file database, attaching without the key fails:

```
Catalog Error: Cannot open encrypted database "..." without a key
```

Both are the expected outcome, and both are what a copy of your storage would give an attacker.

## Operational notes

- **A node that will not start on an encrypted database** is most often a key that does not match
  the file. The symptom is a pool reporting `healthy=false` with `served=0`, which looks identical
  to an occupied node port, so the manager logs a line naming encryption as the likely cause when
  an encrypted database's node goes unhealthy.
- **A database whose recorded encryption disagrees with the catalog** is refused at startup with a
  message naming the cause, rather than failing once per node spawn forever. This happens if a
  catalog created unencrypted is later pointed at by an encrypted database, or the reverse.
- **DuckLake's own checks are asymmetric.** Attaching an unencrypted catalog with encryption
  enabled fails loudly, but attaching an encrypted catalog with encryption disabled succeeds
  silently. The manager's own check is what catches the second case.
