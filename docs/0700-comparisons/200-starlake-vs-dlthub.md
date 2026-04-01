# Starlake vs dlt (dltHub)

Starlake and dlt are both open-source data pipeline tools, but they take fundamentally different approaches.

## Philosophy

| | Starlake | dlt |
|---|---|---|
| **Approach** | Declarative (YAML + SQL) | Imperative (Python code) |
| **Model** | Full ELT platform (Extract, Load, Transform, Orchestrate) | EL library (Extract, Load); delegates Transform to dbt |
| **Configuration** | YAML files — no code required | Python scripts with decorators and dictionaries |
| **Runtime** | Multi-engine (BigQuery, Snowflake, Spark, DuckDB, JDBC) | Python process with destination-specific loaders |

## Data Sources

| | Starlake | dlt |
|---|---|---|
| **Files** | CSV, JSON, XML, Parquet, fixed-width | CSV, JSON, Parquet (XML and fixed-width not native) |
| **Databases** | JDBC extraction with incremental support | 100+ databases via SQLAlchemy |
| **APIs** | — | REST API declarative source, 60+ verified connectors |
| **Streams** | Kafka / Kafka Streams | — |

## Destinations

| | Starlake | dlt |
|---|---|---|
| **Cloud warehouses** | BigQuery, Snowflake, Databricks, Redshift | BigQuery, Snowflake, Databricks, Redshift, Synapse |
| **Databases** | Any JDBC (PostgreSQL, MySQL, ClickHouse, etc.) | PostgreSQL, DuckDB, ClickHouse, SQL Server, 30+ via SQLAlchemy |
| **Local** | DuckDB, filesystem | DuckDB, MotherDuck, filesystem |
| **Lake formats** | Delta Lake, Parquet | Delta Lake, Iceberg |
| **Other** | Elasticsearch, Kafka | Vector databases (Weaviate, LanceDB, Qdrant) |

## Schema Management

| | Starlake | dlt |
|---|---|---|
| **Definition** | Explicit YAML schema with typed attributes | Automatic inference from data |
| **Evolution** | Manual or via `syncStrategy` (NONE, ADD, ALL) | Automatic (evolve, freeze, discard_row, discard_value) |
| **Nested data** | `struct` / `array` types in schema | Auto-flattening into child tables, variant columns |
| **Validation** | Regex-based type checking per value | Pydantic models, schema contracts |

## Write Strategies

| Strategy | Starlake | dlt |
|---|---|---|
| Append | APPEND | `append` |
| Overwrite | OVERWRITE | `replace` |
| Upsert by key | UPSERT_BY_KEY | `merge` + `upsert` strategy |
| Upsert by key + timestamp | UPSERT_BY_KEY_AND_TIMESTAMP | — |
| Partition overwrite | OVERWRITE_BY_PARTITION | `merge` + `delete-insert` strategy |
| Delete then insert | DELETE_THEN_INSERT | `merge` + `delete-insert` strategy |
| SCD2 | SCD2 | `merge` + `scd2` strategy |
| Adaptive (runtime) | ADAPTATIVE | — |

## Transformations

| | Starlake | dlt |
|---|---|---|
| **SQL transforms** | Built-in: SELECT materialization, incremental modelling, variable substitution, dialect transpilation | — |
| **Python transforms** | PySpark scripts with `SL_THIS` view | Pre-load Python transformations on data stream |
| **Computed columns** | `script` property (Spark SQL expressions) | Python `add_map()` / `add_filter()` |
| **Pre/Post hooks** | `presql` / `postsql` | — |
| **Dependency detection** | Automatic FROM/JOIN parsing → DAG | Manual (via dbt or orchestrator) |

## Data Quality

| | Starlake | dlt |
|---|---|---|
| **Type validation** | Regex-based per value; rejected rows → `audit.rejected` | Schema contracts (evolve/freeze/discard) |
| **Expectations** | 53 built-in Jinja2 macros (completeness, validity, volume, schema, uniqueness, numeric) | No built-in expectations engine |
| **Data contracts** | YAML schema + expectations + `failOnError` | Pydantic models + schema contracts |
| **Metrics** | Continuous, discrete, text profiling per column | — |
| **Freshness** | Configurable warn/error thresholds | — |

## Security & Privacy

| | Starlake | dlt |
|---|---|---|
| **Column masking** | HIDE, MD5, SHA1, SHA256, SHA512, AES, SQL expressions | Pseudonymization via `add_map()` (manual) |
| **Row-level security** | Declarative RLS with predicates and grants | — |
| **Column-level access** | `accessPolicy` (BigQuery policy tags) | — |
| **Table ACL** | Declarative ACL with roles and grants | — |

## Orchestration

| | Starlake | dlt |
|---|---|---|
| **Built-in** | DAG generation from SQL dependencies | None — embeds in external orchestrators |
| **Airflow** | Auto-generated DAGs (Bash, Cloud Run, Dataproc, Fargate) | Manual DAG with dlt calls |
| **Dagster** | Auto-generated assets (Shell, Cloud Run, Dataproc, Fargate) | `dagster-dlt` library maps sources to assets |
| **Snowflake Tasks** | Auto-generated native tasks | — |
| **Scheduling** | Cron, data cycles, pre-load strategies (ACK, IMPORTED, PENDING) | — |

## Testing

| | Starlake | dlt |
|---|---|---|
| **Unit tests** | Built-in: load tests + transform tests with DuckDB | Pytest fixtures + assertion helpers |
| **Test data** | CSV/JSON fixtures with `_expected` files | Python dicts / DuckDB local destination |
| **Reports** | JUnit XML + HTML report website | Standard pytest output |
| **Coverage** | Tested vs untested domains/tables tracking | — |
| **SQL transpilation** | Automatic (BigQuery/Snowflake/etc. → DuckDB) | N/A (Python, not SQL) |

## Deployment

| | Starlake | dlt |
|---|---|---|
| **Install** | Java CLI (`starlake` binary) | Python package (`pip install dlt`) |
| **Runtime** | JVM (Spark, standalone) or native engine | Python process |
| **Infrastructure** | On-premise, Cloud Run, Dataproc, Fargate, Snowflake | Anywhere Python runs (Lambda, Cloud Functions, K8s, laptop) |

## When to Choose

**Choose Starlake when:**
- You prefer declarative YAML + SQL over Python code
- You need built-in transformations with automatic dependency resolution
- You need comprehensive data quality (53 expectation macros, type validation, rejection routing)
- You need built-in security (column masking, RLS, ACL)
- You want auto-generated orchestration DAGs
- Your sources are primarily files (CSV, JSON, XML, fixed-width) or JDBC databases
- You work across multiple SQL engines and need dialect transpilation

