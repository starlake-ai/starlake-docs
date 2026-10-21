---
date: 2026-10-15
title: "Securing a DuckDB server in production"
description: "DuckDB was built to run inside one process for one user. Put it behind a server and every SQL user shares its files, credentials and settings. What we had to close when Quack on Demand moved to DuckDB 2.0, and how it now handles all of it by default."
slug: securing-duckdb-server-in-production
authors: [starlake]
tags: [qod, duckdb, ducklake, security, engineering]
---

## Abstract

DuckDB is an in-process database. Its defaults assume that whoever writes the SQL is the person who owns the process: they can read the files it can read, use the cloud keys it can use, and change any setting. That assumption is right on a laptop. It is wrong the moment DuckDB sits behind a server (Quack, Arrow Flight SQL, an HTTP endpoint) and several users send it SQL.

When we moved Quack on Demand to DuckDB 2.0, we audited every way a SQL user of a shared DuckDB node could reach something the operator did not mean to share. This post is the result: eight classes of exposure, a concrete example for each, and what to do about it. We close with how Quack on Demand handles all eight by default, on the DuckDB nodes and in the gateway that checks every statement before it reaches them.

<!-- truncate -->

## The threat model in one sentence

A SQL user of a DuckDB server is not the operating system user that runs it, but by default DuckDB treats them as if they were.

Everything below follows from that. A shared DuckDB process has one filesystem, one environment, one set of secrets, one set of mostly global settings and one extension directory. Any SQL user who can name one of those can usually use it.

## At a glance

| Exposure | What DuckDB does by default |
|---|---|
| Credentials in the process | `getenv()`, `duckdb_databases()` and the CLI's history can show them |
| Persistent secrets | Loads every secret under `~/.duckdb/stored_secrets` |
| The filesystem | Reads files by path, and resolves unknown table names as files |
| Global settings | One session can change threads, memory, logging, the SQL dialect |
| Introspection | Secrets, settings, logs and other sessions' queries are queryable |
| SQL computed at run time | `query()`, `query_table()`, macros and passthroughs run text nobody checked |
| Raw passthrough to other databases | `postgres_execute` runs anything with the node's database role |
| The CLI as a server | stdin is a command channel; dot-commands run on the host |

## 1. Credentials end up wherever SQL can read them

A DuckDB node needs credentials: an object-store key, the password of the Postgres database that holds a DuckLake catalog, tokens for remote catalogs. The easy ways to hand them over all leave them readable from SQL.

- **Environment variables.** `getenv()` is a scalar function. Anything exported to the process is one query away.
- **Command lines.** On Linux, `/proc/<pid>/cmdline` and `/proc/<pid>/environ` of the DuckDB process (and of any wrapper script) are readable by the same OS user.
- **Connection strings.** An `ATTACH 'host=... password=...' (TYPE postgres)` keeps the full string as the database path, and `SELECT path FROM duckdb_databases()` prints it. Connection errors echo it too.
- **The CLI history.** The DuckDB 2.0 CLI records every statement it reads from stdin, in memory, and `shell_history()` returns them. If you start a CLI-based server by piping a setup script into it, every `CREATE SECRET` in that script is now one query away.

**What we do instead.** Secrets reach the node as files in an owner-only directory that the launcher deletes right after reading. Databases are attached through a named temporary secret, which is dropped as soon as the ATTACH returns:

```sql
CREATE TEMPORARY SECRET crm_cred (TYPE postgres, HOST 'pg.internal', PORT 5432,
  DATABASE 'crm', USER 'reporting', PASSWORD '...');
ATTACH '' AS crm (TYPE postgres, SECRET crm_cred, READ_ONLY);
DROP SECRET crm_cred;
```

The attached catalog keeps working after the drop. We checked that it still reconnects after every one of its Postgres backends is terminated from outside. The init script reaches the CLI through `-init` (a FIFO), which the CLI does not record, and never through stdin.

## 2. Persistent secrets load themselves

DuckDB loads every persistent secret it finds under `~/.duckdb/stored_secrets` the first time a secret is needed. On a developer machine this is a feature. On a server, it means the operator's own cloud keys, saved months ago for some unrelated notebook, are now usable by every SQL user of every node started from that account.

The obvious fix, `SET allow_persistent_secrets = false`, has a cost on DuckDB 2.0: every Postgres ATTACH that does not name a secret then fails, including a DuckLake catalog on Postgres:

```text
Invalid Input Error: Unknown secret storage found: "local_file"
```

What works is to keep persistent secrets enabled but give them nowhere to come from and nowhere to go:

```sql
-- before any secret, ATTACH or extension use
SET secret_directory = '/run/node-1234/secrets/none/s';
SELECT count(*) FROM duckdb_secrets();   -- 0, and the setting is now locked
```

Here `secrets` is an empty directory with mode 0500, and `none` is a read-only regular file inside it. Nothing can be loaded from below a file, and nothing can be created there either: `CREATE PERSISTENT SECRET` fails, even for root, which ignores the directory's own permissions. Once the secret manager has been used, DuckDB refuses to change this for every session:

```text
Invalid Input Error: Changing Secret Manager settings after the secret manager is used is not allowed!
```

## 3. The filesystem is part of the SQL surface

DuckDB reads files by path in many places: `read_parquet`, `read_csv`, `glob`, `COPY ... TO`, `ATTACH`, `EXPORT DATABASE`, a string literal in a `FROM` clause. DuckDB 2.0 adds a less obvious one: a table name it cannot resolve is tried as a file. With no schema named `config`, this reads `./config.json` from the process's working directory:

```sql
SELECT * FROM config.json;
```

Quoted names count too. `FROM "s3://bucket/data/*.parquet"` and ``FROM `file:///etc/hosts` `` look like identifiers to anything that only checks table names, and read an object store or a local file with the node's own credentials.

**What to do:**

- **Start every DuckDB process in an empty, private working directory.** Relative names then have nothing to find.
- **Decide who may touch files by path, and refuse it to everyone else.** In Quack on Demand, tenant users cannot read or write files by path at all, whatever their table grants. Federated sources and administrators do it on their behalf.
- **Know what the built-in switches cost.**
  - `enable_external_access = false` is the strongest switch and cannot be turned back on, but it also stops extension loading and remote reads the server itself may need.
  - `allowed_directories` / `allowed_paths` narrow access instead of closing it.
  - `disabled_filesystems = 'LocalFileSystem'` blocks local paths for good, which breaks a DuckLake whose data lives on local disk.
  - None of them tells one user apart from another: they apply to the whole process.
- **A secret's `SCOPE` is a string-prefix match, not a boundary.** It picks which credential applies to a URL; it does not stop anyone from using that credential.

## 4. Most settings are global

In a shared process, many `SET` statements are not about your session. `threads`, `memory_limit`, `temp_directory`, checkpoint and WAL settings, the HTTP client, logging and profiling all change the process for every session. One user running `SET threads = 1` slows down everyone on the node.

Some are worse than slow:

- **Parser settings** (`current_dialect`, `dialect_compatibility_mode`, `preserve_identifier_case` and others) change how every session's SQL is parsed. A gateway that checks SQL before forwarding it can then read the same text differently from the node.
- **`redact_http_logs = false`** or **`allow_unredacted_secrets = true`** put credentials into logs and listings.
- **`file_search_path`** turns relative names into reads of another directory: `SET file_search_path = '/etc'; SELECT * FROM x.csv` reads `/etc/x.csv`.
- **Extension settings and repositories** (`INSTALL ... FROM`, `allow_extension_repositories`, `extension_directories`) decide which binary code the process loads next.
- **SQL-valued settings** such as `pg_pool_health_check_query` run their text later, on every connection taken from the pool.

**What to do:** set what the node needs at startup, and refuse every node-wide setting to ordinary users. Session settings (`TimeZone`, `search_path`, `http_timeout`, `SET VARIABLE`) stay available.

## 5. Introspection is a side channel

DuckDB is generous with metadata, and on a shared server that metadata belongs to other people:

```sql
SELECT * FROM duckdb_secrets();                      -- names, key ids, hosts, users
SELECT current_setting('s3_secret_access_key');      -- an unredacted key
SELECT * FROM duckdb_logs;                           -- other sessions' statements
SELECT path FROM duckdb_databases();                 -- connection strings, file paths
SELECT pg_get_viewdef(oid) FROM range(1, 5000) t(oid);  -- every view's SQL
```

On a Quack server, `quack_active_connections()` lists every session's running query. If the server holds a DuckLake catalog with encryption on, its metadata tables hold every Parquet file's key.

**What to do:** reserve these functions to administrators. Filtering them is not enough: a refused `duckdb_settings()` is pointless if `current_setting()` with a computed name still answers.

## 6. SQL that runs text nobody checked

Several DuckDB functions execute a string or a plan chosen at run time:

- `query('<sql>')` and `query_table('<name>')`;
- `json_execute_serialized_sql`;
- the `*_external_resource` functions, which invoke a function named by a value;
- table macros. In DuckDB 2.0, `histogram()` used in table position runs `query_table()` on its first argument, so `SELECT * FROM histogram('/etc/passwd', column0)` reads a file.

A check that reads statement text sees the call but not what it will run, so `query_table('other_tenant.main.' || 'salaries')` passes a table-level grant check untouched.

**What to do:** treat these as their own class. Refuse them, or at least refuse them whenever their argument is not a constant, to anyone whose access you check table by table. Judge built-in macros by their body, not their name, and pin the list so a new DuckDB release cannot add one silently.

## 7. Raw passthrough ignores READ_ONLY

Attaching another database `READ_ONLY` is engine-level protection, but it has a side door. `postgres_execute` (and `mysql_execute`) send raw SQL to the remote server, and ending DuckDB's remote transaction first lets a write through:

```sql
BEGIN;
CALL postgres_execute('crm', 'COMMIT');
CALL postgres_execute('crm', 'DELETE FROM invoices');   -- lands on the remote server
COMMIT;
```

Building the function name at run time (`query('FROM postgres_' || 'execute(...)')`) hides it from a text screen, and a macro created earlier hides it completely.

**What to do:** refuse passthrough calls aimed at a read-only catalog, and run-time-computed SQL on any node that has one. But the only complete guarantee is on the other side: connect with a remote role that has no write privileges.

## 8. The CLI is not a daemon

Running the DuckDB CLI as a long-lived server process is convenient, and it brings habits from interactive use that do not belong on a server.

- **stdin is a command channel.** Anything that can write to the CLI's stdin can send SQL as the server, and dot-commands like `.shell` run programs on the host. Point stdin at the null device and pass setup through `-init`.
- **`~/.duckdbrc` runs at startup.** `-init` replaces it; otherwise the OS user's own startup file runs inside your server.
- **Do not stay alive with a query.** A long-running query used as a keep-alive pins a transaction. That blocks `CHECKPOINT` on a database file, and holds a Postgres session "idle in transaction" for a DuckLake catalog. On DuckDB 2.0 it can also spin a CPU core. A `.shell` command that waits on the supervising process's pid keeps the CLI alive without a transaction, and dies with it.
- **The working directory and agent mode.** Start the CLI in its private directory, and pass `-no-agent`: DuckDB 2.0 switches to an agent-oriented output format when it detects it is running under an AI tool, which a supervising program will not expect.

## Read SQL the way DuckDB reads it

Every check above depends on reading a statement exactly as DuckDB does, and DuckDB 2.0 moved several goalposts:

- **Backticks quote identifiers**, so ``SELECT * FROM `query_table`('orders')`` is a function call.
- **Adjacent string literals on separate lines are folded** into one value.
- **`EXPLAIN ANALYZE DELETE ...` deletes**, and a `WITH` clause can hold a `DELETE ... RETURNING`.
- **A CTE body binds its own name to the real table:** `WITH orders AS (SELECT * FROM orders)` reads `orders`.

We ended up porting DuckDB's tokenizer into the gateway so that the comment stripper, the statement splitter, the classifier and the access check all see the same tokens DuckDB does. Whatever a check cannot parse, it refuses.

## A checklist

- Credentials never in env vars, command lines, ATTACH strings or stdin; named temporary secrets, dropped after use.
- `secret_directory` below a read-only marker in an empty read-only directory, set before first use.
- Each DuckDB process in an empty private working directory, with its own spill directory.
- File access by path refused to users who should not have it; replacement scans and quoted URLs treated as file reads.
- Node-wide, parser, logging, extension and path settings set at startup and refused afterwards.
- Secrets, settings, logs, database and session listings reserved to administrators.
- Run-time SQL carriers and table macros judged by what they run.
- Remote databases attached `READ_ONLY` and through a role without write privileges.
- stdin closed, `-init` used, no transaction held open to stay alive.

## How Quack on Demand applies this

Quack on Demand serves DuckDB and DuckLake to many users through Arrow Flight SQL, the native Quack protocol and MCP. Every item above is enforced by default on the DuckDB 2.0 release: on the nodes themselves (secret handling, working directory, settings), and in the gateway, which reads each statement with DuckDB's own tokenizer before checking it against the user's grants. Per-pool lockdown applies the same rules to administrators. The [Quack on Demand documentation](/qod/next/introduction) covers how to turn each of them on and what they refuse.
