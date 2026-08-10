---
title: "Your LLM spend is a table you own"
description: "litellm-ducklake-sink writes LiteLLM proxy telemetry to DuckLake, so traces and cost land as Parquet in your own object store."
slug: litellm-ducklake-sink
tags: [ducklake, llm, observability, qod]
authors: [hayssams]
---

We run a self-hosted LiteLLM proxy in front of our development assistants. It routes to commercial provider APIs and to local models, and like any gateway it produces a steady stream of telemetry: 
- who called what
- which model
- how many tokens
- how long it took
- what it cost

<!-- truncate -->

## The category converged on one answer

Every serious LLM observability platform stores traces in ClickHouse. Langfuse was built on it from the start. 
Every trace, every observation, every evaluation result lands in a ClickHouse table, which is
exactly why ClickHouse acquired them in January. Helicone and Opik made the same choice. The workload suits it: high-cardinality, append-heavy, time-series shaped.

That is a reasonable answer, and for interactive trace debugging it is a good one. Clicking through spans during an incident is a latency-sensitive, needle-in-a-haystack query, and ClickHouse is very good at it.

It is a less good answer for the other half of the job. Our LLM telemetry is not interesting in isolation. It becomes interesting when joined against team budgets, against product usage, against the rest of the warehouse. And to do that, the data has to come back out of the platform's schema, in the platform's operational database, through an export pipeline you now own and maintain.


## litellm-ducklake-sink
We already have a lakehouse, so we wrote a LiteLLM callback that appends request telemetry to DuckLake tables over Arrow Flight SQL:

```shell
pip install litellm-ducklake-sink
```

```yaml title="config.yaml"
litellm_settings:
  callbacks: litellm_ducklake_sink.callback.instance
```

Point it at a Flight SQL endpoint, start the proxy, and the tables create themselves on the first flush. 
Then the payoff:

```sql
SELECT model,
       count(*)  AS calls,
       sum(cost) AS spend
FROM llm_requests
WHERE request_day >= today() - 7
GROUP BY 1
ORDER BY spend DESC;
```

No export step. `llm_requests` is a plain DuckLake table. Parquet on your object store, partitioned by day. 
Your BI tool reads it. A notebook reads it. Joining it to your billing tables is a join, not a project.

Writes are batched by row count and interval so the logging path stays off the request hot path. Batches that cannot be delivered spool to disk and replay on a later cycle. Delivery is at-least-once, so deduplicate by `request_id` if you need exact spend accounting. Prompt and response capture is opt-in and off by default. Retention is a separate job you run from cron or a CronJob.

It is Apache-2.0, and it needs no changes to LiteLLM. It uses the documented custom callback mechanism.

- Repository: https://github.com/starlake-ai/litellm-ducklake-sink
- Package: https://pypi.org/project/litellm-ducklake-sink/
- The Flight SQL server we run it against: https://qod.starlake.ai