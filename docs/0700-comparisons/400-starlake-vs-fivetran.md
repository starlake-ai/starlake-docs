# Starlake vs Fivetran

Starlake and Fivetran both move data into cloud warehouses, but they differ in scope, openness, and how much of the pipeline they own.

## Philosophy

| | Starlake | Fivetran |
|---|---|---|
| **Approach** | Declarative (YAML + SQL) | Managed connectors (UI + REST/Terraform) |
| **Model** | Full ELT platform (Extract, Load, Transform, Orchestrate) | EL platform (Extract, Load); Transform via Fivetran Transformations (dbt Core) |
| **Configuration** | YAML files — no code required | UI-driven, REST API, or Terraform provider |
| **Runtime** | Multi-engine (BigQuery, Snowflake, Spark, DuckDB, JDBC) | Fivetran-managed cloud (or Hybrid Deployment agent in your VPC) |
| **License** | Open source | Proprietary SaaS |

## Data Sources

| | Starlake | Fivetran |
|---|---|---|
| **Connectors** | Files, JDBC databases, REST APIs, Kafka | 500+ pre-built connectors (SaaS, APIs, databases, files, events) |
| **Files** | CSV, JSON, XML, Parquet, fixed-width | CSV, JSON, Parquet, Avro, XLSX (via S3/GCS/Azure/SFTP/Box/Dropbox) |
| **Databases** | JDBC extraction with incremental support | Log-based CDC for Postgres, MySQL, Oracle, SQL Server, MongoDB, etc. |
| **APIs** | REST API extraction (any JSON/XML API) with auth, pagination, rate limiting, incremental support | SaaS connectors (Salesforce, HubSpot, NetSuite, Workday, Stripe, etc.) |
| **Streams** | Kafka / Kafka Streams | Kafka, Kinesis, Confluent Cloud |
| **Custom sources** | OpenAPI schema extraction for automatic table generation | Connector SDK (Python) and Cloud Functions connectors |

## Destinations

| | Starlake | Fivetran |
|---|---|---|
| **Cloud warehouses** | BigQuery, Snowflake, Databricks, Redshift | BigQuery, Snowflake, Databricks, Redshift, Synapse |
| **Databases** | Any JDBC (PostgreSQL, MySQL, ClickHouse, etc.) | PostgreSQL, MySQL, SQL Server, MariaDB, Panoply |
| **Local** | DuckDB, filesystem | — |
| **Lake formats** | Delta Lake, Parquet | Iceberg, Delta Lake (via Databricks/Managed Iceberg) |
| **Other** | Elasticsearch, Kafka | S3, ADLS, GCS (data lake destinations) |

## Schema Management

| | Starlake | Fivetran |
|---|---|---|
| **Definition** | Explicit YAML schema with typed attributes | Automatic inference from source schema |
| **Evolution** | Manual or via `syncStrategy` (NONE, ADD, ALL) | Automatic schema drift handling (allow, block, or unblock per column) |
| **Nested data** | `struct` / `array` types in schema | JSON columns or auto-flattening (destination-dependent) |
| **Validation** | Regex-based type checking per value | Source-driven type mapping |

## Write Strategies

| Strategy | Starlake | Fivetran |
|---|---|---|
| Append | APPEND | History Mode (append-only with `_fivetran_active`) |
| Overwrite | OVERWRITE | Re-sync (full refresh) |
| Upsert by key | UPSERT_BY_KEY | Default — primary-key-based merge |
| Upsert by key + timestamp | UPSERT_BY_KEY_AND_TIMESTAMP | CDC with `_fivetran_synced` cursor |
| Partition overwrite | OVERWRITE_BY_PARTITION | — |
| Delete then insert | DELETE_THEN_INSERT | — |
| SCD2 | SCD2 | History Mode (Type 2 change tracking) |
| Adaptive (runtime) | ADAPTATIVE | — |

## Transformations

| | Starlake | Fivetran |
|---|---|---|
| **SQL transforms** | Built-in: SELECT materialization, incremental modelling, variable substitution, dialect transpilation | Fivetran Transformations (dbt Core, scheduled or integrated) |
| **Python transforms** | PySpark scripts with `SL_THIS` view | — |
| **Computed columns** | `script` property (Spark SQL expressions) | — |
| **Pre/Post hooks** | `presql` / `postsql` | dbt pre/post hooks |
| **Dependency detection** | Automatic FROM/JOIN parsing → DAG | Via dbt manifest |
| **Pre-built models** | — | Quickstart Data Models (analytics-ready dbt packages per connector) |

## Data Quality

| | Starlake | Fivetran |
|---|---|---|
| **Type validation** | Regex-based per value; rejected rows → `audit.rejected` | Source-driven type coercion |
| **Expectations** | 53 built-in Jinja2 macros (completeness, validity, volume, schema, uniqueness, numeric) | dbt tests (via Transformations) |
| **Data contracts** | YAML schema + expectations + `failOnError` | — |
| **Metrics** | Continuous, discrete, text profiling per column | Sync-level metrics (MAR, rows, volume) |
| **Freshness** | Configurable warn/error thresholds | Connector-level scheduling, alerting, and Fivetran Platform Connector for monitoring |

## Security & Privacy

| | Starlake | Fivetran |
|---|---|---|
| **Column masking** | HIDE, MD5, SHA1, SHA256, SHA512, AES, SQL expressions | Column hashing and column blocking per source |
| **Row-level security** | Declarative RLS with predicates and grants | — |
| **Column-level access** | `accessPolicy` (BigQuery policy tags) | Column blocking (exclude from sync) |
| **Table ACL** | Declarative ACL with roles and grants | RBAC at workspace/connector level |
| **Secrets** | Environment variables | Managed secrets, PrivateLink, customer-managed keys |
| **Compliance** | Self-managed | SOC 2 Type II, HIPAA, GDPR, ISO 27001, PCI DSS |
| **Data residency** | Wherever you deploy | Multi-region (US, EU, AU, APAC, Hybrid Deployment in your VPC) |

## Orchestration

| | Starlake | Fivetran |
|---|---|---|
| **Built-in** | DAG generation from SQL dependencies | Built-in scheduler (15-minute to 24-hour sync frequencies) |
| **Airflow** | Auto-generated DAGs (Bash, Cloud Run, Dataproc, Fargate) | Airflow provider (`airflow-provider-fivetran`) |
| **Dagster** | Auto-generated assets (Shell, Cloud Run, Dataproc, Fargate) | `dagster-fivetran` integration |
| **Snowflake Tasks** | Auto-generated native tasks | — |
| **API triggers** | — | REST API to trigger syncs and manage connectors |

## Testing

| | Starlake | Fivetran |
|---|---|---|
| **Unit tests** | Built-in: load tests + transform tests with DuckDB | dbt tests (within Transformations) |
| **Test data** | CSV/JSON fixtures with `_expected` files | — |
| **Reports** | JUnit XML + HTML report website | Sync logs, dashboards, Fivetran Platform Connector |
| **Coverage** | Tested vs untested domains/tables tracking | — |
| **SQL transpilation** | Automatic (BigQuery/Snowflake/etc. → DuckDB) | N/A |

## Deployment

| | Starlake | Fivetran |
|---|---|---|
| **Install** | Java CLI (`starlake` binary) | SaaS account (Free, Standard, Enterprise, Business Critical) |
| **Runtime** | native engine or Spark | Fivetran-managed |
| **Infrastructure** | On-premise, Cloud Run, Dataproc, Fargate, Snowflake | Fivetran Cloud, or Hybrid Deployment (agent in customer VPC) |
| **Managed offering** | — | Fully managed SaaS |
| **Pricing** | Free (open source) | Consumption-based (Monthly Active Rows) |
