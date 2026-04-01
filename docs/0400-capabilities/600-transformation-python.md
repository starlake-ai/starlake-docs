# Transformation Capabilities for Python

## 1. PySpark Runtime

Python transforms require a Spark runtime (Databricks, EMR, or standalone Spark). They do **not** work with DuckDB, BigQuery, or Snowflake standalone engines.

## 2. Output via SL_THIS View

The transform script must register its result as a temporary view named `SL_THIS`. Starlake reads this view to materialize the output into the target table.

```python
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder.getOrCreate()

result = (
    spark.table("starbake.products")
    .groupBy("category")
    .agg(
        F.sum(F.col("quantity") * F.col("sale_price")).alias("total_revenue"),
        F.sum("quantity").alias("total_units_sold")
    )
)

result.createOrReplaceTempView("SL_THIS")
```

## 3. Schema Matching

If the target table exists, the DataFrame schema must match the table schema. If the target table does not exist, Starlake infers the schema from the DataFrame.

## 4. Parameter Passing

Arguments are passed via the `--options` flag and converted to command-line arguments for the script.

```bash
starlake transform --name domain.task --options key1=value1,key2=value2
```

This is converted to:

```bash
task.py --key1 value1 --key2 value2
```

Parse with `argparse` or `sys.argv` in the script.

## 5. Source Table Access

Any table accessible to the Spark session can be read with `spark.table("schema.table")`. This includes tables loaded by Starlake ingestion and tables from external catalogs.

## 6. YAML Configuration

Python transforms use the same `.sl.yml` configuration file as SQL transforms, supporting all the same properties: write strategies, partitioning, clustering, ACL, RLS, expectations, export, freshness, and scheduling.

```yaml
task:
  writeStrategy:
    type: OVERWRITE
  sink:
    partition:
      - category
    clustering:
      - product_id
```

## 7. Write Strategies

All write strategies available for SQL transforms are supported:

| Strategy | Description |
|---|---|
| `APPEND` | Insert all new rows (default) |
| `OVERWRITE` | Replace all existing rows |
| `UPSERT_BY_KEY` | Merge by key |
| `UPSERT_BY_KEY_AND_TIMESTAMP` | Merge by key with timestamp comparison |
| `OVERWRITE_BY_PARTITION` | Overwrite only affected partitions |
| `DELETE_THEN_INSERT` | Delete matching keys, then insert |
| `SCD2` | Slowly Changing Dimension Type 2 |

## 8. Pre/Post SQL Hooks

SQL statements can be executed before and after the Python transform via `presql` and `postsql` in the YAML configuration.

```yaml
task:
  presql:
    - "TRUNCATE TABLE staging.ml_features"
  postsql:
    - "ANALYZE TABLE ml.predictions COMPUTE STATISTICS"
```

## 9. Cross-Database Writes

The `sink.connectionRef` property directs output to a specific database connection.

```yaml
task:
  sink:
    connectionRef: target_db
```

## 10. Export to Files

Results can be exported to files (CSV, JSON, Parquet, Avro, ORC) with optional coalescing.

```yaml
task:
  sink:
    format: parquet
    path: mnt/data/ml_output
    coalesce: true
```

## 11. Access Control

Table-level ACL and row-level security (RLS) are applied to the output table using the same syntax as SQL transforms and ingestion.

```yaml
task:
  acl:
    - role: SELECT
      grants:
        - user:analyst@company.com
  rls:
    - name: "region filter"
      predicate: "region = 'EMEA'"
      grants:
        - "group:emea-team"
```

## 12. Post-Transform Expectations

Data quality assertions are evaluated after the transform completes. See the full [Expectations reference](./700-expectations.md) for all 53 built-in macros covering completeness, validity, volume, schema, uniqueness, and numeric checks.

## 13. Scheduling and DAG Integration

Python transforms support cron scheduling and DAG triggering.

```yaml
task:
  schedule: "0 3 * * *"
  dagRef: "ml_pipeline"
```

## 14. Task Timeout

A `taskTimeoutMs` property sets the maximum execution time in milliseconds.

```yaml
task:
  taskTimeoutMs: 7200000
```

## 15. Freshness Monitoring

The `freshness` property defines staleness thresholds for the output data.

```yaml
task:
  freshness:
    warn: "12h"
    error: "1d"
```

---

## SQL vs Python Comparison

| Aspect | SQL | Python |
|---|---|---|
| Source file | `.sql` | `.py` |
| Runtime | DuckDB, BigQuery, Snowflake, Spark, Databricks | Spark, Databricks, EMR only |
| Use case | Standard queries, joins, aggregations | ML, text processing, API calls, complex logic |
| Output mechanism | SELECT result | `SL_THIS` temporary view |
| YAML configuration | Same format | Same format |
| Pre/Post SQL hooks | Supported | Supported |
| Write strategies | All | All |
| Expectations | Supported | Supported |

---

## Summary

| Capability | Category |
|---|---|
| PySpark DataFrame processing | Core |
| Output via `SL_THIS` temporary view | Core |
| Schema inference or matching | Core |
| Parameter passing (`--options`) | Core |
| Pre/Post SQL hooks (`presql` / `postsql`) | Core |
| Write strategies (APPEND, OVERWRITE, UPSERT, SCD2, etc.) | Write |
| Cross-database writes (`sink.connectionRef`) | Write |
| Partitioning and clustering | Write |
| Export to files (CSV, JSON, Parquet, Avro, ORC) | Export |
| Access control (ACL, RLS) | Security |
| Post-transform expectations | Data Quality |
| Freshness monitoring | Data Quality |
| Scheduling and DAG integration | Orchestration |
| Task timeout | Orchestration |