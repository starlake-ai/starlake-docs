---
sidebar_position: 3
title: Setup
description: Detailed installation, configuration, and project structure for Starlake Skills
---

# Setup

## Installation Methods

Both methods end in the same state: every skill folder is symlinked into the skills directory of each AI assistant (`~/.claude/skills/`, `~/.copilot/skills/`, `~/.gemini/skills/`), where it is discovered automatically from its `SKILL.md` frontmatter. No build step or registration is involved.

### Quick Install from a Release (recommended)

Downloads the latest versioned archive from [GitHub Releases](https://github.com/starlake-ai/starlake-skills/releases) into `~/.starlake-skills` and links the skills. Only `curl` and `tar` required (PowerShell 5.1+ on Windows):

```bash
curl -fsSL https://raw.githubusercontent.com/starlake-ai/starlake-skills/main/scripts/install-remote.sh | bash
```

Options pass through to the inner installer: `--pin vX.Y.Z` for an exact release, `--platforms claude,copilot`, `--local`, `--uninstall`.

### From a Git Clone (contributors)

Symlinks point into the clone, so edits to any `SKILL.md` and every `git pull` are live immediately:

```bash
git clone https://github.com/starlake-ai/starlake-skills.git ~/.starlake-skills
~/.starlake-skills/scripts/install.sh
```

### Versions and Channels

```bash
~/.starlake-skills/scripts/install.sh --update --channel stable   # newest release tag
~/.starlake-skills/scripts/install.sh --update --channel latest   # main branch
~/.starlake-skills/scripts/install.sh --pin v1.2.0                # exact release
~/.starlake-skills/scripts/install.sh --version                   # installed version
```

### Project-Local Installation

Scope skills to a specific project with `--local`: links go into `./.claude/skills/` (and the other assistants' local folders) instead of `$HOME`:

```bash
cd your-starlake-project
~/.starlake-skills/scripts/install.sh --local
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

- **[Skills Catalog](../0200-catalog/index.md)**: Browse all available skills
- **[Connections](../0300-configure/connections.md)**: Detailed connection setup
- **[Warehouses](../0300-configure/warehouses.md)**: Warehouse-specific guides
