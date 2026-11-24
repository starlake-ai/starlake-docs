---
description: "Starlake vs SQLMesh: full ELT pipeline in YAML and SQL versus a transform framework with virtual data environments. Compares data branches with virtual data environments, change impact, promotion, testing, orchestration and governance."
keywords: [starlake vs sqlmesh, sqlmesh alternative, virtual data environments, data branching, zero-copy clone, starlake comparison, data pipeline]
---

# Starlake vs SQLMesh

SQLMesh is an open-source transformation framework: it builds and runs SQL and Python models over data that is already in the warehouse. Starlake covers the whole pipeline: extraction, loading, transformation, data quality and orchestration, declared in YAML and SQL. The overlap is the transform layer, and the most visible difference there is how each tool lets you try a change on production data before shipping it.

Facts about SQLMesh on this page come from its documentation for v0.236 (October 2026).

## Philosophy

| | Starlake | SQLMesh |
|---|---|---|
| **Scope** | Full ELT: extract, load, transform, test, orchestrate | Transform only: sources are external models SQLMesh does not manage |
| **Models** | YAML + standard SQL, Python (PySpark) | SQL with SQLMesh macros or Jinja, Python models returning a DataFrame |
| **Change workflow** | `starlake impact` reports what a change touches, you run the impacted tasks on a data branch, then in production | `sqlmesh plan`: diff the project against an environment, categorize the changes, backfill, promote |
| **State** | No separate state database | State database, recommended on PostgreSQL for production |
| **Project** | Apache 2.0, Starlake | Apache 2.0, a Linux Foundation project since March 2026 (created by Tobiko Data, acquired by Fivetran in 2025) |

## Trying changes on production data

This is where the two tools differ most. SQLMesh builds **virtual data environments**. Starlake builds **data branches**.

| | Starlake data branches | SQLMesh virtual data environments |
|---|---|---|
| **Mechanism** | Zero-copy `CLONE` of production tables into a branch dataset or schema, then SQL rewriting so the job reads and writes the clones | Every model version gets its own physical table, named by a fingerprint of its code and its upstream models. An environment is a set of views pointing at physical tables |
| **What a new branch or environment costs** | Nothing is copied upfront: each table is cloned the first time a job on the branch uses it | Nothing is built for unchanged models: their views point at the production tables. Changed models are computed |
| **Granularity** | One namespace per branch; tables cloned one by one, on first use | One schema per model schema, suffixed with the environment name (`db__dev.model`) |
| **Change impact** | Reported: `starlake impact` diffs the project against a Git ref, classifies each direct change as `BREAKING`, `NON_BREAKING`, `ADDED` or `METADATA`, and lists the downstream tasks it impacts through column-level lineage. Nothing is run: you choose which tasks to run on the branch | Automatic: directly and indirectly modified models are found from the project, and each change is categorized as breaking (downstream rebuilt) or non-breaking (only the changed model rebuilt) |
| **Promotion** | Recompute: run the job again in production. On Snowflake, `BRANCH APPLY` replays the branch's SQL on production | Usually a view swap: production points at the tables built in dev, with no recompute. Forward-only changes, `dev_only` mode and dev backfills on a limited date range are recomputed in production |
| **Freshness of production data** | BigQuery: sources frozen when first cloned. Snowflake: tables the branch never modified are read live | Unchanged models read the production tables; changed models are computed over the date range you choose |
| **Cleanup** | Manual: drop the branch dataset or schema | Janitor: expired environments (1 week by default) and orphaned snapshots are removed by `sqlmesh run` or `sqlmesh janitor` |
| **Engines** | BigQuery, Snowflake | 19 engines, including BigQuery, Snowflake, Databricks, Redshift, PostgreSQL, DuckDB, Spark and Trino. Zero-copy clones, used for forward-only previews, only on BigQuery, Databricks and Snowflake |

In short:

- **SQLMesh avoids recomputation.** Once a change is built in dev, production reuses the result, and its change categorization decides how much of the DAG to rebuild. The price is a layer of views between consumers and tables, a state database, and the plan workflow.
- **Starlake branches need no layer and no state.** Your tables stay plain tables, and a branch is ordinary warehouse objects you can query and drop. The price is a recompute at promotion, and you decide what to run on the branch.

How Starlake branches work in detail, with an end-to-end walkthrough: [Testing on production data with data branches](../0300-guides/0400-unit-tests/300-data-branches.mdx).

## Data sources and loading

| | Starlake | SQLMesh |
|---|---|---|
| **Files** | CSV, JSON, XML, Parquet, fixed-width, with schema validation and rejected-row routing | Seed models: static CSV files in the project |
| **Databases** | JDBC extraction, incremental, with [CDC](/starflow/guides/load/cdc) | Not covered: external models describe tables loaded by other tools |
| **Streams** | Kafka | Not covered |
| **Loaders** | Built in | dlt integration generates models over tables dlt has loaded |

## Transformations

| | Starlake | SQLMesh |
|---|---|---|
| **SQL** | Standard SQL with variable substitution | SQL with SQLMesh macros (`@`) or Jinja |
| **Python** | PySpark scripts | Python models returning a Pandas or Spark DataFrame |
| **Dialects** | Transpilation with JSqlTranspiler | Transpilation with SQLGlot |
| **Write strategies** | APPEND, OVERWRITE, UPSERT_BY_KEY, UPSERT_BY_KEY_AND_TIMESTAMP, OVERWRITE_BY_PARTITION, DELETE_THEN_INSERT, SCD2, ADAPTATIVE | Model kinds: FULL, INCREMENTAL_BY_TIME_RANGE, INCREMENTAL_BY_UNIQUE_KEY, INCREMENTAL_BY_PARTITION, SCD_TYPE_2, VIEW and others |
| **Dependencies** | Parsed from the SQL | Parsed from the SQL |
| **Column-level lineage** | `starlake col-lineage` | In the UI |
| **dbt projects** | Migration to YAML + SQL | Runs dbt projects through its dbt adapter |

## Testing and data quality

| | Starlake | SQLMesh |
|---|---|---|
| **Unit tests** | Load and transform tests on DuckDB with CSV or JSON fixtures, SQL transpiled automatically | YAML tests with inputs and expected outputs, run on `plan` |
| **Assertions on real data** | 53 built-in expectation macros, on loads and transforms | Audits, blocking by default, with built-in audits |
| **Testing on production data** | Data branches (BigQuery, Snowflake) | Virtual data environments |
| **Comparing outputs** | SQL over the branch and production tables | `sqlmesh table_diff` between environments |
| **Load validation** | Type checks per value, rejected rows to `audit.rejected` | Not covered |

## Security and governance

| | Starlake | SQLMesh |
|---|---|---|
| **Column masking** | Declarative: HIDE, hashing, AES, SQL expressions | Not built in |
| **Row-level security** | Declarative RLS | Not built in |
| **Table ACL** | Declarative grants | Your own SQL or macros in `before_all` / `after_all` statements |

## Orchestration

| | Starlake | SQLMesh |
|---|---|---|
| **Built in** | DAG generation from the SQL dependencies | `sqlmesh run`, triggered by cron or CI |
| **Airflow** | Generated DAGs | Open-source integration removed in v0.175 (April 2025); offered by Tobiko Cloud |
| **Dagster** | Generated assets | Offered by Tobiko Cloud |
| **Snowflake Tasks** | Generated native tasks | Not covered |

## When to choose

**Choose Starlake when:**
- You want one tool for extraction, loading, transformation and orchestration
- You need load-time validation, masking, RLS and ACLs declared next to the schema
- You want plain tables, with no view layer or state database to operate
- You want generated Airflow, Dagster or Snowflake Tasks DAGs

**Choose SQLMesh when:**
- You only need a transformation layer, and loading is handled by another tool
- Avoiding recomputation at promotion matters more to you than keeping tables free of a view layer
- You want the categorization of a change to decide what is rebuilt, with no manual step
- Your warehouse is one Starlake branches do not cover, such as Databricks or Redshift, and you need environments there
