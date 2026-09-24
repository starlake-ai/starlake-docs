---
id: sql
title: Running SQL
description: "Run one-shot or interactive SQL against a DuckDB gateway with qod sql, the Arrow Flight SQL client built into the command-line tool."
keywords: ["qod sql", "duckdb repl", "flight sql cli", "interactive sql"]
---

`qod sql` talks to the FlightSQL edge on `:31338`, the same plane every other client (DBeaver, Power BI, `tpch-load-test`) connects to. It runs one statement and exits, or - with no statement argument - drops into an interactive REPL.

## One-shot

```bash
qod sql "SELECT count(*) FROM lineitem" --tenant acme --pool bi
```

Against the TPC-H demo bootstrap (`tenant=acme`, `pool=bi`, table `lineitem` in schema `main` of the `acme_tpch` tenant-db) this returns a single row. `--tenant` and `--pool` override whatever the active profile has stored; if you already ran `qod login` and it saved a tenant/pool you can usually omit them.

Credentials for the FlightSQL handshake are resolved in this order:

1. `QOD_PASSWORD` environment variable
2. `sql_password` in the active profile - opt-in; `qod login` never writes it, you set it explicitly if you want to skip the prompt
3. An interactive prompt, once per invocation

The username (`sql_user`) comes from `qod login`, or `QOD_USER` / the profile. Pass `--superuser` to send the superuser call header instead of a tenant/pool pair - useful for the admin database connection, or for cross-tenant catalog work:

```bash
qod sql "SELECT * FROM acme_tpch.main.lineitem LIMIT 5" --superuser
```

## Output formats

The same query, redirected to a file or piped through `jq`:

```bash
qod sql "SELECT * FROM lineitem" --tenant acme --pool bi --csv > out.csv
qod --json sql "SELECT count(*) FROM lineitem" --tenant acme --pool bi | jq .
```

`--csv` is specific to `qod sql`; `--json` is the same top-level flag every other command uses. They are mutually exclusive.

## REPL

Run `qod sql` with no statement argument to get an interactive prompt. Statements can span multiple lines and only run once terminated with `;`; a bad statement prints its error and returns to the prompt instead of exiting:

```
$ qod sql --tenant acme --pool bi
qod> SELECT count(*)
...>   FROM lineitem
...>   WHERE l_shipdate < DATE '1995-01-01';
┌──────────────┐
│ count_star() │
├──────────────┤
│ 3405838      │
└──────────────┘
qod> SELECT * FROM nonexistent_table;
error: Catalog Error: Table with name nonexistent_table does not exist
qod> \q
```

`\q` or Ctrl-D leaves the REPL; Ctrl-C clears the statement being typed without exiting.

## Time travel from the CLI

The `catalog` commands expose the same snapshot browsing and time-travel reads available through the REST API and in DBeaver/Power BI. `tenant` and `db` are positional here (the full `acme_tpch` name, not the `tpch` suffix passed to `database create`):

```bash
# Recent snapshots for the whole tenant-db, or filtered to one table
qod catalog snapshots acme acme_tpch --limit 5

# Read a table as of a specific snapshot
qod catalog preview acme acme_tpch main lineitem --as-of <SNAPSHOT_ID>

# Row-level diff between two snapshots (or tags, or timestamps)
qod catalog data-diff acme acme_tpch main lineitem --from <A> --to <B>
```

`--as-of` also accepts `--as-of-tag` or `--as-of-ts` (mutually exclusive with each other); `--from` / `--to` on `data-diff` and `schema-diff` accept the same kinds of snapshot selectors. See [Time travel](/qod/concepts/catalogs) for what a snapshot selector can be, and the [Command reference](/qod/cli/reference) for the full `catalog` and `tag` verb lists (including `recoverable` / `undrop` for dropped tables).

## Branches from the CLI

`--branch` routes a session to a writable branch of the pool's database; authorization still runs against `--pool`. The `branch` command group manages the lifecycle (see [Branching](/qod/operating/branching)):

```bash
qod branch create --tenant acme --db acme_tpch --name feature-x --ttl-hours 24
qod sql --tenant acme --pool bi --branch feature-x "UPDATE nation SET n_comment = 'reviewed' WHERE n_nationkey = 3"
qod branch changes --tenant acme --db acme_tpch --branch feature-x
qod branch diff --tenant acme --db acme_tpch --branch feature-x --schema main --table nation
qod branch propose --tenant acme --db acme_tpch --branch feature-x
qod --profile reviewer branch merge --tenant acme --db acme_tpch --branch feature-x
```

`QOD_BRANCH` sets the default branch for `qod sql` the way `QOD_POOL` sets the pool. The merge must come from a different principal than the proposer, which is why the example switches profile.

## TLS

The FlightSQL edge has TLS on by default with a self-signed certificate auto-generated on first boot, so certificate verification is off by default too (`edge_tls_verify` / `QOD_TLS_VERIFY` default to `false`). Once you deploy a real certificate, set `QOD_TLS_VERIFY=true` (or `edge_tls_verify = true` in the profile) to verify it instead of trusting any certificate the edge presents.
