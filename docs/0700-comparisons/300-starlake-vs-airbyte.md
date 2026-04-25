# Starlake vs Airbyte

Starlake and Airbyte are both open-source data integration tools, but they serve different roles in the data stack.

## Philosophy

| | Starlake | Airbyte |
|---|---|---|
| **Approach** | Declarative (YAML + SQL) | Connector-based (UI + YAML) |
| **Model** | Full ELT platform (Extract, Load, Transform, Orchestrate) | EL platform (Extract, Load); delegates Transform to dbt or SQL |
| **Configuration** | YAML files — no code required | UI-driven or Terraform/YAML (Octavia CLI) |
| **Runtime** | Multi-engine (BigQuery, Snowflake, Spark, DuckDB, JDBC) | Docker-based connector pods (Cloud or self-hosted) |

## Data Sources

| | Starlake | Airbyte |
|---|---|---|
| **Connectors** | Files, JDBC databases, REST APIs, Kafka | 400+ pre-built connectors (SaaS, APIs, databases, files) |
| **Files** | CSV, JSON, XML, Parquet, fixed-width | CSV, JSON, Parquet, Avro (via File/S3/GCS sources) |
| **Databases** | JDBC extraction with incremental support and [CDC](/guides/load/cdc) (push via Debezium/Kafka, pull via watermark) | CDC (Debezium), incremental, full refresh per connector |
| **APIs** | REST API extraction (any JSON/XML API) with auth, pagination, rate limiting, incremental support | REST APIs, GraphQL, SaaS platforms (Salesforce, HubSpot, Stripe, etc.) |
| **Streams** | Kafka / Kafka Streams | — |
| **Custom sources** | OpenAPI schema extraction for automatic table generation | Connector Builder (low-code) or Connector Development Kit (Python) |

## Destinations

| | Starlake | Airbyte |
|---|---|---|
| **Cloud warehouses** | BigQuery, Snowflake, Databricks, Redshift | BigQuery, Snowflake, Databricks, Redshift |
| **Databases** | Any JDBC (PostgreSQL, MySQL, ClickHouse, etc.) | PostgreSQL, MySQL, MSSQL, Oracle, ClickHouse, 50+ others |
| **Local** | DuckDB, filesystem | DuckDB, local JSON/CSV |
| **Lake formats** | Delta Lake, Parquet | Iceberg, Delta Lake (via Databricks) |
| **Other** | Elasticsearch, Kafka | S3, GCS, Azure Blob, Kafka, Vector databases |

## Schema Management

| | Starlake | Airbyte |
|---|---|---|
| **Definition** | Explicit YAML schema with typed attributes | Automatic inference from source catalog |
| **Evolution** | Manual or via `syncStrategy` (NONE, ADD, ALL) | Automatic: propagate or ignore column changes |
| **Nested data** | `struct` / `array` types in schema | Auto-flattening or raw JSON column (normalization) |
| **Validation** | Regex-based type checking per value | Basic type coercion |

## Write Strategies

| Strategy | Starlake | Airbyte |
|---|---|---|
| Append | APPEND | `append` |
| Overwrite | OVERWRITE | `overwrite` |
| Upsert by key | UPSERT_BY_KEY | Deduped + history (cursor + primary key) |
| Upsert by key + timestamp | UPSERT_BY_KEY_AND_TIMESTAMP | Deduped (cursor-based incremental) |
| Partition overwrite | OVERWRITE_BY_PARTITION | — |
| Delete then insert | DELETE_THEN_INSERT | — |
| SCD2 | SCD2 | — |
| Adaptive (runtime) | ADAPTATIVE | — |

## CDC (Change Data Capture)

| | Starlake | Airbyte |
|---|---|---|
| **Push-based CDC** | Debezium/Kafka ingestion with automatic offset tracking | Built-in Debezium CDC for supported database connectors |
| **Pull-based CDC** | Incremental JDBC extraction with `SL_LAST_EXPORT` watermark tracking | Cursor-based incremental sync |
| **File-based CDC** | Load change files with operation column, merge via transform | — |
| **Delete propagation** | `presql` for delete handling, soft-delete support | `_airbyte_extracted_at` + soft deletes (`_fivetran_deleted` equivalent) |
| **SCD2 history** | Built-in SCD2 write strategy with configurable start/end timestamps | — |
| **Deduplication** | `SOURCE_AND_TARGET` deduplicates within batch before merge | Deduped sync mode with cursor + primary key |

## Transformations

| | Starlake | Airbyte |
|---|---|---|
| **SQL transforms** | Built-in: SELECT materialization, incremental modelling, variable substitution, dialect transpilation | — |
| **Python transforms** | PySpark scripts with `SL_THIS` view | — |
| **Computed columns** | `script` property (Spark SQL expressions) | — |
| **Pre/Post hooks** | `presql` / `postsql` | — |
| **Dependency detection** | Automatic FROM/JOIN parsing → DAG | — |
| **dbt integration** | — | dbt Cloud integration for post-load transforms |

## Data Quality

| | Starlake | Airbyte |
|---|---|---|
| **Type validation** | Regex-based per value; rejected rows → `audit.rejected` | Basic type coercion at load |
| **Expectations** | 53 built-in Jinja2 macros (completeness, validity, volume, schema, uniqueness, numeric) | — |
| **Data contracts** | YAML schema + expectations + `failOnError` | — |
| **Metrics** | Continuous, discrete, text profiling per column | Sync-level metrics (records emitted/committed) |
| **Freshness** | Configurable warn/error thresholds | Connection-level scheduling and alerting |

## Security & Privacy

| | Starlake | Airbyte |
|---|---|---|
| **Column masking** | HIDE, MD5, SHA1, SHA256, SHA512, AES, SQL expressions | — |
| **Row-level security** | Declarative RLS with predicates and grants | — |
| **Column-level access** | `accessPolicy` (BigQuery policy tags) | — |
| **Table ACL** | Declarative ACL with roles and grants | — |
| **Secrets** | Environment variables | Built-in secrets management (Cloud), env vars (OSS) |

## Orchestration

| | Starlake | Airbyte |
|---|---|---|
| **Built-in** | DAG generation from SQL dependencies | Built-in scheduler (cron-based) |
| **Airflow** | Auto-generated DAGs (Bash, Cloud Run, Dataproc, Fargate) | Airflow provider (`apache-airflow-providers-airbyte`) |
| **Dagster** | Auto-generated assets (Shell, Cloud Run, Dataproc, Fargate) | `dagster-airbyte` integration |
| **Snowflake Tasks** | Auto-generated native tasks | — |
| **API triggers** | — | REST API to trigger syncs programmatically |

## Testing

| | Starlake | Airbyte |
|---|---|---|
| **Unit tests** | Built-in: load tests + transform tests with DuckDB | — |
| **Test data** | CSV/JSON fixtures with `_expected` files | — |
| **Reports** | JUnit XML + HTML report website | Sync logs and metrics in UI |
| **Coverage** | Tested vs untested domains/tables tracking | — |
| **SQL transpilation** | Automatic (BigQuery/Snowflake/etc. → DuckDB) | N/A |

## Deployment

| | Starlake | Airbyte |
|---|---|---|
| **Install** | Java CLI (`starlake` binary) | Docker Compose (OSS) or Airbyte Cloud (managed) |
| **Runtime** | JVM (Spark, standalone) or native engine | Docker containers (one per connector) |
| **Infrastructure** | On-premise, Cloud Run, Dataproc, Fargate, Snowflake | Self-hosted (K8s, Docker), Airbyte Cloud |
| **Managed offering** | — | Airbyte Cloud (fully managed SaaS) |

## When to Choose

**Choose Starlake when:**
- You prefer declarative YAML + SQL over UI-driven configuration
- You need built-in transformations with automatic dependency resolution
- You need comprehensive data quality (53 expectation macros, type validation, rejection routing)
- You need built-in security (column masking, RLS, ACL)
- You want auto-generated orchestration DAGs
- Your sources are primarily files (CSV, JSON, XML, fixed-width), JDBC databases, REST APIs, or Kafka streams
- You work across multiple SQL engines and need dialect transpilation