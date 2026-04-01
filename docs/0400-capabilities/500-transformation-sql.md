# SQL Transformations

## 1. SELECT Materialization

A transform is a standard SQL `SELECT` statement stored in a `.sql` file. Starlake materializes the query result into the target table. If the target table exists, the result schema must match; if it does not exist, Starlake infers the schema from the result.

```sql
SELECT
    o.order_id,
    SUM(ol.quantity * ol.sale_price) AS total_revenue
FROM
    starbake.orders o
    JOIN starbake.order_lines ol ON o.order_id = ol.order_id
GROUP BY
    o.order_id
```

## 2. Custom DML Statements

When `parseSQL` is set to `false`, Starlake executes the SQL as-is without conversion. This allows `MERGE`, `INSERT`, `UPDATE`, and other DML statements to be used directly.

```yaml
task:
  parseSQL: false
```

## 3. Incremental Modelling

Two reserved variables support time-based incremental processing:

- `{{sl_start_date}}` — start of the current processing interval.
- `{{sl_end_date}}` — end of the current processing interval.

```sql
SELECT
    product_id,
    SUM(amount) AS daily_revenue
FROM sales.transactions
WHERE
    transaction_date >= '{{sl_start_date}}'
    AND transaction_date < '{{sl_end_date}}'
GROUP BY product_id
```

A catchup mechanism in the orchestrator (Airflow, Dagster, Snowflake Tasks) replays missed intervals with the correct variable values.

## 4. Variable Substitution

Any environment variable can be referenced with `{{variable}}` syntax. Variables are resolved before the SQL is sent to the database engine. This is direct substitution, not Jinja templating.

Built-in variables include: `SL_CURRENT_TIMESTAMP`, `SL_CURRENT_DATE`, `SL_CURRENT_TIME`.

## 5. SQL Dialect Transpilation

Starlake can transpile SQL across database dialects, allowing portable transforms between engines (BigQuery, Snowflake, Spark, DuckDB, JDBC databases).

## 6. Pre/Post SQL Hooks

SQL statements can be executed before and after the main transform via `presql` and `postsql`.

```yaml
task:
  presql:
    - "TRUNCATE TABLE staging.summary"
  postsql:
    - "ANALYZE TABLE kpi.revenue_summary COMPUTE STATISTICS"
```

## 7. Automatic Dependency Detection

Starlake parses `FROM` and `JOIN` clauses to build a directed acyclic graph (DAG) of table dependencies. Upstream tables always execute before downstream ones.

```bash
# View dependency graph
starlake lineage --task kpi.order_summary --print

# Generate SVG visualization (requires GraphViz)
starlake lineage --task kpi.order_summary --svg --output lineage.svg
```

## 8. Recursive Execution

Running a transform with `--recursive` automatically executes all upstream dependencies first.

```bash
starlake transform --recursive --name kpi.order_summary
```

## 9. Write Strategies

The `writeStrategy.type` property controls how results are written to the target table:

| Strategy | Description |
|---|---|
| `APPEND` | Insert all new rows (default) |
| `OVERWRITE` | Replace all existing rows |
| `UPSERT_BY_KEY` | Merge by key (update existing, insert new) |
| `UPSERT_BY_KEY_AND_TIMESTAMP` | Merge by key, update only if incoming timestamp is newer |
| `OVERWRITE_BY_PARTITION` | Overwrite only partitions present in the result |
| `DELETE_THEN_INSERT` | Delete matching keys, then insert all rows |
| `SCD2` | Slowly Changing Dimension Type 2 (preserve history) |

Additional write strategy properties:

- `key` — column(s) forming the merge/upsert key.
- `timestamp` — timestamp column for ordering (required for UPSERT_BY_KEY_AND_TIMESTAMP, optional for SCD2).
- `startTs` / `endTs` — SCD2 effective date range columns.
- `queryFilter` — SQL WHERE clause for merge source selection. Supports `latest` for BigQuery latest partition and `in last(N)` syntax for partition range filtering.
- `on` — merge condition target: `TARGET` or `SOURCE_AND_TARGET`.

## 10. Materialization Types

The transform output can be materialized as different object types:

| Type | Description |
|---|---|
| `TABLE` | Physical table |
| `VIEW` | SQL view |
| `MATERIALIZED_VIEW` | Precomputed materialized view |

## 11. Cross-Database Reads and Writes

- `connectionRef` at task level sets the source database.
- `sink.connectionRef` sets the target database.
- A single transform can read from one database and write to another.

```yaml
task:
  connectionRef: source_db
  sink:
    connectionRef: target_db
```

## 12. Partitioning and Clustering

```yaml
task:
  sink:
    partition:
      - column1
      - column2
    clustering:
      - column3
      - column4
```

## 13. Schema and Table Override

By default, the directory name becomes the target schema and the file name becomes the target table. Both can be overridden.

```yaml
task:
  domain: custom_schema
  table: custom_table
```

## 14. Column Documentation

Calculated or derived columns can be documented directly in the YAML configuration. Column-level access policies are also supported.

```yaml
task:
  attributesDesc:
    - name: "total_revenue"
      comment: "Sum of quantity * sale_price per order"
      accessPolicy: "PII"
```

## 15. Access Control

Table-level ACL and row-level security (RLS) can be applied to transform outputs.

```yaml
task:
  acl:
    - role: SELECT
      grants:
        - user:user@starlake.ai
        - group:analysts@starlake.ai
        - serviceAccount:sa@project.iam.gserviceaccount.com
  rls:
    - name: "USA only"
      predicate: "country = 'USA'"
      grants:
        - "group:us-team"
```

## 16. Post-Transform Expectations

Data quality assertions are evaluated after the transform completes. See the full [Expectations reference](./700-expectations.md) for all 53 built-in macros covering completeness, validity, volume, schema, uniqueness, and numeric checks.

## 17. Export to Files

Transform results can be exported to files (CSV, JSON, Parquet, Avro, ORC, XLS) instead of — or in addition to — a database table. The path is relative to `root` defined in `application.sl.yml`. Cloud storage paths (GCS, S3, ADLS) are supported.

```yaml
task:
  sink:
    format: csv
    extension: csv
    path: mnt/data/output.csv
    coalesce: true
```

## 18. DAG Generation and Scheduling

Starlake generates orchestration DAGs from the dependency graph for Airflow, Dagster, or Snowflake Tasks.

```bash
starlake dag-generate
```

Transforms can also define a cron `schedule` and a `dagRef` to trigger downstream DAGs after completion.

```yaml
task:
  schedule: "0 2 * * *"
  dagRef: "downstream_pipeline"
```

## 19. Task Timeout

A `taskTimeoutMs` property sets the maximum execution time in milliseconds.

```yaml
task:
  taskTimeoutMs: 3600000
```

## 20. Freshness Monitoring

The `freshness` property defines staleness thresholds for the output data.

```yaml
task:
  freshness:
    warn: "6h"
    error: "1d"
```

## 21. Primary Key Declaration

The `primaryKey` property declares the output table's primary key columns.

```yaml
task:
  primaryKey:
    - "order_id"
```

## 22. Attribute Sync Strategy

The `syncStrategy` property controls how the target table schema evolves:

| Strategy | Description |
|---|---|
| `NONE` | No synchronization |
| `ADD` | Add new attributes from source (default) |
| `ALL` | Sync all attributes (add/remove to match source) |

---

## Summary

| Capability | Category |
|---|---|
| SELECT materialization with schema inference | Core |
| Custom DML via `parseSQL: false` | Core |
| Incremental modelling (`sl_start_date` / `sl_end_date`) | Core |
| Variable substitution (`{{variable}}`) | Core |
| SQL dialect transpilation | Core |
| Pre/Post SQL hooks (`presql` / `postsql`) | Core |
| Automatic dependency detection (FROM / JOIN parsing) | Orchestration |
| Recursive execution (`--recursive`) | Orchestration |
| DAG generation (Airflow, Dagster, Snowflake Tasks) | Orchestration |
| Scheduling (`schedule`, `dagRef`) | Orchestration |
| Task timeout (`taskTimeoutMs`) | Orchestration |
| Write strategies (APPEND, OVERWRITE, UPSERT, SCD2, etc.) | Write |
| Materialization types (TABLE, VIEW, MATERIALIZED_VIEW) | Write |
| Cross-database reads and writes (`connectionRef`) | Write |
| Partitioning and clustering | Write |
| Export to files (CSV, JSON, Parquet, Avro, ORC, XLS) | Export |
| Schema and table name override | Configuration |
| Column documentation (`attributesDesc`) | Configuration |
| Attribute sync strategy (`syncStrategy`) | Configuration |
| Primary key declaration | Configuration |
| Access control (ACL, RLS) | Security |
| Column-level access policies (`accessPolicy`) | Security |
| Post-transform expectations | Data Quality |
| Freshness monitoring | Data Quality |