---
id: skills-catalog
sidebar_position: 1
title: Skills Catalog
description: Browse all 47 Starlake Skills organized by category
---

# Skills Catalog

Starlake Skills provides **47 specialized skills** organized into 11 categories. Each skill contains deep knowledge about a specific Starlake CLI command, configuration pattern, or operational workflow.

## At a Glance

| Category | Count | Description |
|---|---|---|
| [Ingestion & Loading](./ingestion.md) | 9 | Ingest data from files, APIs, Kafka, and Elasticsearch |
| [Transformation](./transformation.md) | 2 | SQL and Python data transformations |
| [Extraction](./extraction.md) | 5 | Extract schemas and data from databases |
| [Schema Management](./schema-management.md) | 6 | Bootstrap projects, convert formats, generate DDL |
| [Data Quality](./data-quality.md) | 1 | Expectation macros and validation patterns |
| [Lineage & Dependencies](./lineage.md) | 4 | Column-level, table-level, and ACL lineage |
| [Operations](./operations.md) | 8 | Validation, metrics, freshness, migrations |
| [Security](./security.md) | 2 | IAM policies, RLS, CLS, privacy |
| [Orchestration](./orchestration.md) | 2 | Airflow and Dagster DAG management |
| [Utilities](./utilities.md) | 6 | Format conversion, comparison, testing, site generation |
| [Configuration](./configuration.md) | 2 | Configuration reference and database connections |

## How Skills Work

Each skill is invoked through Claude Code using natural language or the `/skill-name` pattern:

```
# Natural language
You: Help me configure a load job for my CSV files

# Direct skill invocation
You: /load Configure loading CSV files into the customers domain
```

Claude automatically selects the most relevant skill based on your question and provides:

- **CLI command syntax** with all available flags and options
- **YAML configuration examples** ready to copy into your project
- **Write strategy guidance** for your specific use case
- **Engine-specific behavior** (Spark, Native, DuckDB)
- **Best practices** for production deployments

## Quick Reference

### Most Common Skills

| Skill | What It Does |
|---|---|
| `bootstrap` | Create a new Starlake project from template |
| `load` | Configure data loading with write strategies |
| `transform` | Set up SQL/Python transformations |
| `connection` | Configure database connections |
| `dag-generate` | Generate Airflow/Dagster DAGs |
| `validate` | Validate project configuration |
| `config` | Reference for all configuration options |
| `expectations` | Set up data quality checks |

### Configuration Skills

| Skill | What It Does |
|---|---|
| `config` | Full configuration reference (env vars, app structure, types) |
| `connection` | Create and modify database connections |
| `settings` | Application settings management |
