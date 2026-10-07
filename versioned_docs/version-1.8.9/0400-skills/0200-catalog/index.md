---
id: skills-catalog
sidebar_position: 1
title: Skills Catalog
description: Browse all Starlake Skills organized by category
---

# Skills Catalog

Starlake Skills are organized into categories covering every Starlake CLI command, configuration pattern, and operational workflow.

## At a Glance

| Category | Description |
|---|---|
| [Ingestion & Loading](./ingestion.md) | Ingest data from files, APIs, Kafka, and Elasticsearch |
| [Transformation](./transformation.md) | SQL and Python data transformations |
| [Extraction](./extraction.md) | Extract schemas and data from databases |
| [Schema Management](./schema-management.md) | Bootstrap projects, convert formats, generate DDL |
| [Data Quality](./data-quality.md) | Expectation macros and validation patterns |
| [Semantic Layer](./semantic.md) | Business semantic models for BI tools and AI agents |
| [Lineage & Dependencies](./lineage.md) | Column-level, table-level, and ACL lineage |
| [Operations](./operations.md) | Validation, metrics, freshness, migrations |
| [Security](./security.md) | IAM policies, RLS, CLS, privacy |
| [Orchestration](./orchestration.md) | Airflow and Dagster DAG management |
| [Utilities](./utilities.md) | Format conversion, comparison, testing, site generation |
| [Configuration](./configuration.md) | Configuration reference and database connections |

## How Skills Work

Each skill is invoked through your AI assistant (Claude Code, GitHub Copilot, or Gemini CLI) using natural language, or in Claude Code with the `/skill-name` pattern:

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
