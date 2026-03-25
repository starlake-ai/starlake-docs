---
sidebar_position: 3
title: Setup
description: Detailed installation, configuration, and project structure for Starlake Skills
---

# Setup

## Installation Methods

### Global Installation

Install once, use everywhere. Skills are available in all Claude Code sessions:

```bash
git clone https://github.com/starlake-ai/starlake-skills.git ~/.claude/skills/starlake-skills
```

### Project-Local Installation

Scope skills to a specific project. Useful when you want version-pinned skills:

```bash
cd your-starlake-project
git clone https://github.com/starlake-ai/starlake-skills.git .claude/skills/starlake-skills
```

Add to `.gitignore` if you don't want to commit the plugin:

```
.claude/skills/
```

### Marketplace (Coming Soon)

```bash
claude plugin install starlake-skills
```

## Starlake Project Structure

Starlake Skills expects the standard Starlake project layout:

```
your-project/
├── metadata/
│   ├── application.sl.yml          # Global config & connections
│   ├── env.sl.yml                  # Environment variables
│   ├── env.DEV.sl.yml              # Dev-specific overrides
│   ├── env.PROD.sl.yml             # Prod-specific overrides
│   ├── types/
│   │   └── default.sl.yml          # Data type definitions
│   ├── load/                       # Ingestion configurations
│   │   └── {domain}/
│   │       ├── _config.sl.yml      # Domain config
│   │       └── {table}.sl.yml      # Table schemas
│   ├── transform/                  # Transformation definitions
│   │   └── {domain}/
│   │       ├── {task}.sl.yml       # Task config
│   │       └── {task}.sql          # SQL logic
│   ├── extract/                    # Extraction configurations
│   ├── expectations/               # Data quality macros
│   ├── dags/                       # Orchestration templates
│   └── secure/                     # Security policies
├── datasets/                       # Data storage
│   ├── incoming/                   # Landing area
│   ├── pending/                    # Staging area
│   ├── accepted/                   # Validated data
│   ├── rejected/                   # Failed records
│   └── business/                   # Transformed data
└── starlake.sh                     # CLI wrapper script
```

## Connection Configuration

Connections are defined in `metadata/application.sl.yml`:

```yaml
application:
  connections:
    my-bigquery:
      type: BQ
      options:
        location: EU
        authType: APPLICATION_DEFAULT
    my-snowflake:
      type: JDBC
      options:
        url: "jdbc:snowflake://account.snowflakecomputing.com"
        user: "{{SNOWFLAKE_USER}}"
        password: "{{SNOWFLAKE_PASSWORD}}"
        warehouse: COMPUTE_WH
        db: ANALYTICS
    my-duckdb:
      type: JDBC
      options:
        url: "jdbc:duckdb:/path/to/database.db"
    my-postgres:
      type: JDBC
      options:
        url: "jdbc:postgresql://localhost:5432/mydb"
        user: "{{PG_USER}}"
        password: "{{PG_PASSWORD}}"
```

### Connection Types

| Type | Description | Use Case |
|---|---|---|
| `BQ` | Google BigQuery | Cloud data warehouse |
| `JDBC` | Generic SQL databases | Snowflake, PostgreSQL, DuckDB, Redshift |
| `FS` | File System | Local or cloud storage (GCS, S3) |
| `ES` | Elasticsearch | Search engine indexing |
| `KAFKA` | Apache Kafka | Event streaming |

## Environment Variables

Use `env.sl.yml` for variable substitution across your configuration:

```yaml
env:
  SL_ROOT: "/path/to/project"
  SL_ENV: "DEV"
  SL_INCOMING: "{{SL_ROOT}}/datasets/incoming"
  SL_WAREHOUSE: "COMPUTE_WH"
```

Override per environment with `env.{ENV}.sl.yml`:

```yaml
# env.PROD.sl.yml
env:
  SL_ENV: "PROD"
  SL_INCOMING: "gs://prod-bucket/incoming"
  SL_WAREHOUSE: "PROD_WH"
```

## Verifying Your Setup

Run the validate skill to check your project:

```
You: /validate Check my entire Starlake project for configuration errors
```

This will verify:
- YAML schema compliance
- Connection references
- Domain and table configurations
- Type definitions
- Environment variable resolution

## Next Steps

- **[Skills Catalog](../0200-catalog/index.md)** — Browse all available skills
- **[Connections](../0300-configure/connections.md)** — Detailed connection setup
- **[Warehouses](../0300-configure/warehouses.md)** — Warehouse-specific guides
