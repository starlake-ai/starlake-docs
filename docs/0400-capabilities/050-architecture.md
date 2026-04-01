# Architecture

## 1. Declarative Pipeline Model

Starlake is a declarative data platform. All pipeline behavior is defined in YAML configurations and SQL queries — no imperative code is required. The same definitions work across multiple engines (BigQuery, Snowflake, Spark, DuckDB, any JDBC database) with automatic SQL dialect transpilation.

## 2. Pipeline Stages

Data flows through four stages:

```
EXTRACT ──→ LOAD ──→ TRANSFORM ──→ ORCHESTRATE
```

| Stage | Input | Output | Purpose |
|---|---|---|---|
| **Extract** | JDBC databases | Files (CSV, JSON, Parquet) | Pull data from external sources |
| **Load** | Files (CSV, JSON, XML, Parquet, fixed-width) | Validated warehouse tables | Ingest, validate, and write to target tables |
| **Transform** | Warehouse tables | Derived tables, views, or files | SQL/Python analytics and KPI computation |
| **Orchestrate** | YAML + SQL dependencies | DAGs (Airflow, Dagster, Snowflake Tasks) | Schedule and coordinate execution |

## 3. Project Directory Structure

Every Starlake project follows a standardized layout:

```
$SL_ROOT/
├── metadata/                     # Pipeline definitions (source of truth)
│   ├── application.sl.yml        # Global config: connections, engines, audit
│   ├── env.sl.yml                # Environment variables
│   ├── env.SNOWFLAKE.sl.yml      # Engine-specific overrides
│   ├── types/                    # Data type definitions (regex-based)
│   │   └── default.sl.yml
│   ├── load/                     # Ingestion definitions
│   │   └── {domain}/
│   │       ├── _config.sl.yml    # Domain-level defaults
│   │       └── {table}.sl.yml    # Table schema + validation rules
│   ├── extract/                  # JDBC extraction definitions
│   │   └── {connection}.sl.yml
│   ├── transform/                # SQL/Python transformation definitions
│   │   └── {domain}/
│   │       ├── _config.sl.yml
│   │       ├── {task}.sql
│   │       └── {task}.sl.yml     # Optional task config
│   ├── expectations/             # Data quality macros (.j2 templates)
│   ├── dags/                     # DAG templates for orchestrators
│   └── tests/                    # Unit test definitions
│       ├── load/
│       └── transform/
│
└── datasets/                     # Data storage (staged pipeline)
    ├── incoming/                 # Raw data arrives here
    ├── staging/                  # Files matched to schemas
    ├── ingesting/                # Currently being processed
    ├── archive/                  # Successfully ingested files
    ├── unresolved/               # Files not matching any schema
    └── replay/                   # Files for replay processing
```

`metadata/` is the source of truth — entirely declarative. `datasets/` follows a staged architecture where data progresses through well-defined areas.

## 4. File Staging Pipeline

During ingestion, files progress through ordered areas:

```
incoming/         Files land here (manual drop or automated delivery)
    ↓ pattern matching against table schemas
staging/          Files matched to a table definition
    ↓ ingestion job picks up files
ingesting/        Files currently being processed
    ↓
archive/          Successfully loaded files
unresolved/       Files that didn't match any schema pattern
```

Pattern matching uses the `pattern` regex defined in each table's YAML configuration. Files are moved atomically between areas to prevent duplicate processing.

## 5. Engine Abstraction

Starlake decouples pipeline definitions from execution engines. The same YAML + SQL runs on any supported backend:

| Engine | Use Case |
|---|---|
| **DuckDB** | Local development, testing, small datasets |
| **Apache Spark** | On-premise or Databricks, large-scale processing |
| **Google BigQuery** | GCP native, serverless analytics |
| **Snowflake** | Cloud data warehouse via JDBC |
| **Any JDBC database** | PostgreSQL, MySQL, Redshift, ClickHouse, etc. |

SQL dialect differences are handled by an automatic transpiler. Engine-specific configuration overrides live in `env.{ENGINE}.sl.yml` files.

## 6. Connection System

Connections are centrally defined in `application.sl.yml` and referenced by name throughout the project:

```yaml
application:
  connectionRef: "default"
  connections:
    default:
      type: "jdbc"
      options:
        url: "jdbc:snowflake://account.snowflakecomputing.com/"
        user: "{{SNOWFLAKE_USER}}"
        password: "{{SNOWFLAKE_PASSWORD}}"
        warehouse: "COMPUTE_WH"
    analytics_bq:
      type: "bigquery"
      options:
        location: "europe-west1"
        authType: "APPLICATION_DEFAULT"
    local:
      type: "jdbc"
      options:
        url: "jdbc:duckdb:./datasets/duckdb.db"
```

Any load or transform task can override the default connection with `connectionRef`. A single transform can read from one connection and write to another via `sink.connectionRef`.

## 7. Metadata Model

Three core metadata objects drive the pipeline:

### Table Schema (Load)

Defines how to parse, validate, and write a file format:

```yaml
table:
  name: "orders"
  pattern: "orders_.*.json"
  metadata:
    format: "JSON"
    writeStrategy:
      type: "UPSERT_BY_KEY"
      key: ["order_id"]
  attributes:
    - name: "order_id"
      type: "long"
      required: true
    - name: "amount"
      type: "decimal"
      privacy: "SHA256"
```

### Task (Transform)

Defines a SQL or Python transformation with its write behavior:

```yaml
task:
  name: "revenue_summary"
  writeStrategy:
    type: "OVERWRITE"
  sink:
    partition: ["date"]
    clustering: ["product_id"]
```

### DAG (Orchestrate)

Defines how to generate orchestration code:

```yaml
dag:
  template: "load/airflow_scheduled_table_bash.py.j2"
  filename: "dag_{{domain}}.py"
  options:
    schedule: "0 2 * * *"
```

## 8. Write Strategy Pattern

Starlake decouples **what data to produce** (SQL query) from **how to write it** (merge logic). The write strategy generates the appropriate MERGE, INSERT, or UPDATE statements automatically for the target engine:

| Strategy | Generated Logic |
|---|---|
| `APPEND` | INSERT all rows |
| `OVERWRITE` | DROP + INSERT or TRUNCATE + INSERT |
| `UPSERT_BY_KEY` | MERGE ON key (update matched, insert unmatched) |
| `UPSERT_BY_KEY_AND_TIMESTAMP` | MERGE ON key, update only if newer timestamp |
| `SCD2` | MERGE with effective date range management |
| `OVERWRITE_BY_PARTITION` | DELETE partition + INSERT |
| `DELETE_THEN_INSERT` | DELETE matching keys + INSERT all |

The same write strategy YAML works identically on BigQuery, Snowflake, Spark, and JDBC databases.

## 9. Dependency Resolution and Lineage

Starlake automatically parses SQL `FROM` and `JOIN` clauses to build a directed acyclic graph (DAG) of table dependencies. This powers:

- **Recursive execution** — `starlake transform --recursive` runs all upstream dependencies first.
- **DAG generation** — `starlake dag-generate` produces orchestration code with correct task ordering.
- **Lineage visualization** — `starlake lineage` outputs table and column dependency graphs (text, SVG, PNG, JSON).

## 10. Validation and Audit

Every ingested record passes through a validation pipeline:

```
Parse → Type check (regex) → Required check → Privacy transform → Script compute → Filter → Write
                ↓ (failures)
         audit.rejected table
```

- **Type validation**: each value is checked against a regex pattern defined in `metadata/types/`.
- **Rejected records**: rows failing any check are routed to `audit.rejected` for inspection.
- **Post-load expectations**: data quality macros run after write and can halt the pipeline on failure.
- **Metrics**: optional statistical profiling (continuous, discrete, text) per column.

## 11. Security Model

Security is applied declaratively at multiple levels:

| Level | Mechanism |
|---|---|
| **Column** | `privacy` (HIDE, MD5, SHA256, AES, SQL expressions) masks data at ingestion |
| **Column access** | `accessPolicy` restricts column visibility (BigQuery policy tags) |
| **Row** | `rls` (row-level security) applies WHERE predicates per user/group |
| **Table** | `acl` (access control list) grants roles to users, groups, or service accounts |

## 12. Testing Architecture

Tests run locally using DuckDB with automatic SQL transpilation from the target dialect. No cloud credentials are needed.

- **Load tests**: verify file ingestion (parsing, validation, rejection routing).
- **Transform tests**: verify SQL logic against expected output.
- **Expectations**: data quality macros validate post-write assertions.

Reports are generated as JUnit XML (CI/CD) and HTML (browsable site).

## 13. CLI Command Map

| Command | Stage | Purpose |
|---|---|---|
| `starlake bootstrap` | Setup | Initialize a new project |
| `starlake extract-schema` | Extract | Infer schema from JDBC source |
| `starlake extract` | Extract | Pull data from JDBC databases |
| `starlake infer-schema` | Load | Infer schema from sample files |
| `starlake load` | Load | Ingest staged files into warehouse |
| `starlake transform` | Transform | Execute SQL/Python transformations |
| `starlake lineage` | Transform | Visualize table/column dependencies |
| `starlake dag-generate` | Orchestrate | Generate DAGs for orchestrators |
| `starlake dag-deploy` | Orchestrate | Deploy DAGs to orchestrator |
| `starlake test` | Test | Run unit tests locally with DuckDB |
| `starlake validate` | Ops | Validate metadata consistency |
| `starlake metrics` | Ops | Compute data quality metrics |

---

## Summary

| Architectural Property | Description |
|---|---|
| Declarative definitions | YAML configs + SQL queries, no imperative code |
| Multi-engine execution | Same definitions on BigQuery, Snowflake, Spark, DuckDB, JDBC |
| Automatic SQL transpilation | Cross-dialect portability |
| Staged file processing | incoming → staging → ingesting → archive |
| Centralized connections | Defined once in `application.sl.yml`, referenced by name |
| Write strategy abstraction | Merge logic decoupled from data definitions |
| Automatic dependency resolution | SQL parsing builds DAGs for orchestration and lineage |
| Built-in validation and audit | Type checking, rejection routing, expectations, metrics |
| Declarative security | Column masking, row-level security, access control |
| Local testing with DuckDB | No cloud credentials needed for development |
