---
title: "LiteLLM telemetry in DuckLake, without an export pipeline"
description: "litellm-ducklake-sink 0.2.0 writes LiteLLM proxy telemetry straight into DuckLake: a SQLite file and a folder to start, Postgres and S3 in production, or a QoD gateway."
slug: litellm-ducklake-sink
tags: [ducklake, duckdb, llm, litellm, observability, qod]
authors: [hayssams]
---

We run a self-hosted LiteLLM proxy in front of our development assistants. It routes to commercial provider APIs and to local models, and like any gateway it produces a steady stream of telemetry: 
- who called what
- which model
- how many tokens
- how long it took
- what it cost

<!-- truncate -->

:::note
Updated on November 11, 2026 for litellm-ducklake-sink 0.2.0, which writes to DuckLake directly. The first release wrote through Arrow Flight SQL only.
:::

## The category converged on one answer

Every serious LLM observability platform stores traces in ClickHouse. Langfuse was built on it from the start. 
Every trace, every observation, every evaluation result lands in a ClickHouse table, which is
exactly why ClickHouse acquired them in January. Helicone and Opik made the same choice. The workload suits it: high-cardinality, append-heavy, time-series shaped.

That is a reasonable answer, and for interactive trace debugging it is a good one. Clicking through spans during an incident is a latency-sensitive, needle-in-a-haystack query, and ClickHouse is very good at it.

It is a less good answer for the other half of the job. Our LLM telemetry is not interesting in isolation. It becomes interesting when joined against team budgets, against product usage, against the rest of the warehouse. And to do that, the data has to come back out of the platform's schema, in the platform's operational database, through an export pipeline you now own and maintain.


## litellm-ducklake-sink
We already have a lakehouse, so we wrote a LiteLLM callback that appends request telemetry to DuckLake tables. Since 0.2.0 it writes to DuckLake itself: the sink embeds DuckDB and attaches the lake, so nothing runs between LiteLLM and your data.

```shell
pip install 'litellm[proxy]' litellm-ducklake-sink
```

```yaml title="config.yaml"
litellm_settings:
  callbacks: litellm_ducklake_sink.callback.instance
```

Two settings are enough to start: a catalog, here a SQLite file, and a folder for the Parquet files.

```shell title=".env"
DUCKLAKE_SINK_CATALOG=sqlite:lake/catalog.sqlite
DUCKLAKE_SINK_DATA_PATH=lake/data/
```

LiteLLM looks for a `.env` above its own install folder, not in the folder you start it from, so load the file into the shell, then start the proxy. The tables create themselves on the first flush.

```shell
set -a; . ./.env; set +a
litellm --config config.yaml
```

Then the payoff, from any DuckDB, while the proxy keeps running:

```sql
ATTACH 'ducklake:sqlite:lake/catalog.sqlite' AS lake (READ_ONLY);

SELECT model_group,
       count(*)                                AS calls,
       round(sum(spend), 4)                    AS spend,
       round(quantile_cont(latency_ms, 0.95))  AS p95_ms
FROM lake.main.llm_requests
WHERE request_day >= current_date - 7
GROUP BY 1
ORDER BY spend DESC;
```

No export step. `llm_requests` is a plain DuckLake table. Parquet in your folder or object store, partitioned by day. 
Your BI tool reads it. A notebook reads it. Joining it to your billing tables is a join, not a project.

The [README's quickstart](https://github.com/starlake-ai/litellm-ducklake-sink#quickstart-litellm-to-ducklake-in-5-minutes) runs all of this in five minutes with a mock model, so it needs no provider key and no server.

## From one file to production

The same sink follows the setup as it grows. Set `DUCKLAKE_SINK_CATALOG` to write to DuckLake directly, or `DUCKLAKE_SINK_ENDPOINT` to write through a server, never both. In the table, `CATALOG` stands for `DUCKLAKE_SINK_CATALOG`, and so on.

| You have | Set |
|---|---|
| One host, nothing to run | `CATALOG=sqlite:lake/catalog.sqlite` |
| Several proxy replicas | `CATALOG=postgres:dbname=lake host=db ...`, with a `DATA_PATH` they all share |
| Parquet on S3, R2 or MinIO | `DATA_PATH=s3://bucket/prefix/`, with keys from `S3_KEY_ID` and `S3_SECRET`, or the AWS credential chain |
| A DuckDB server hosting the catalog | `CATALOG=quack:host:9494` and its `QUACK_TOKEN` |
| A DuckDB server with the lake attached | `ENDPOINT=quack:host:port` |
| A [QoD](https://qod.starlake.ai) gateway | `ENDPOINT=grpc+tls://host:31338`, its Arrow Flight SQL edge, as in 0.1 |

The repository has a complete env file for the [SQLite](https://github.com/starlake-ai/litellm-ducklake-sink/blob/main/examples/ducklake-sqlite.env), [Postgres](https://github.com/starlake-ai/litellm-ducklake-sink/blob/main/examples/ducklake-postgres.env) and [QoD](https://github.com/starlake-ai/litellm-ducklake-sink/blob/main/examples/qod.env) setups, with every default spelled out.

One rule matters early: DuckLake records the data path in the catalog on the first write and refuses a different one afterwards. Choose it, S3 included, before the proxy writes anything.

## How it behaves

Writes are batched by row count, interval and size, so logging stays off the request hot path. Batches that cannot be delivered spool to disk and replay on a later cycle. In a container, point the spool at a persistent volume. Delivery is at-least-once, so deduplicate by `request_id` if you need exact spend accounting. Prompt and response capture is opt-in and off by default.

A misconfigured sink stops the proxy at boot with one error line naming the setting, instead of silently dropping telemetry. An unreachable lake does not stop it: the proxy serves traffic and the batches wait in the spool.

The sink only appends. Expiring old rows belongs to whoever hosts the lake: QoD on its side, or a scheduled job for your own catalog. Rows are partitioned by day, so deleting whole days is cheap:

```sql
DELETE FROM lake.main.llm_requests WHERE request_day < current_date - INTERVAL 30 DAY;
DELETE FROM lake.main.llm_payloads WHERE request_day < current_date - INTERVAL 30 DAY;
CALL ducklake_expire_snapshots('lake', older_than => now() - INTERVAL 7 DAY);
CALL ducklake_cleanup_old_files('lake', cleanup_all => true);
```

## Upgrading from 0.1

- Flight SQL settings keep working unchanged.
- The retention job is gone: `python -m litellm_ducklake_sink.retention`, `DUCKLAKE_SINK_RETENTION_DAYS`, `DUCKLAKE_SINK_TENANT_DB`, `DUCKLAKE_SINK_MAINTENANCE_URL` and `DUCKLAKE_SINK_MAINTENANCE_API_KEY`. The settings are ignored if still set. Schedule the SQL above, or let QoD expire the rows.
- The package now depends on `duckdb>=2.0.0`.
- A misconfigured sink raises `DuckLakeSinkMisconfiguredError`. It is a `ValueError`, so existing handlers still catch it.

It is Apache-2.0, and it needs no changes to LiteLLM. It uses the documented custom callback mechanism.

- Repository: https://github.com/starlake-ai/litellm-ducklake-sink
- Package: https://pypi.org/project/litellm-ducklake-sink/
- The gateway we run it against: https://qod.starlake.ai
