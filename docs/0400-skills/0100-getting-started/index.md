---
id: getting-started-overview
sidebar_position: 1
title: Overview
description: Get started with Starlake Skills — the Claude Code plugin for Starlake data pipelines
---

# Getting Started

**Starlake Skills** is an open-source Claude Code plugin that provides **48 specialized skills** for building, configuring, and operating [Starlake](https://starlake.ai) data pipelines.

Whether you're setting up a new data project, configuring ingestion pipelines, writing transformations, or deploying orchestration DAGs — Starlake Skills gives your AI assistant deep expertise in every aspect of the Starlake platform.

## What You Can Do

| Category | Skills | Examples |
|---|---|---|
| **Ingestion & Loading** | 9 skills | Auto-infer schemas, load CSV/JSON/XML, Kafka, Elasticsearch |
| **Transformation** | 2 skills | SQL/Python transformations with write strategies |
| **Extraction** | 5 skills | Extract schemas and data from BigQuery, JDBC sources |
| **Schema Management** | 5 skills | Bootstrap projects, Excel-to-YAML, DDL generation |
| **Data Quality** | 1 skill | Expectations with Jinja2 macros and validation patterns |
| **Lineage** | 4 skills | Column-level, table-level, and ACL dependency tracking |
| **Operations** | 8 skills | Validation, metrics, freshness, GizmoSQL, migrations |
| **Security** | 2 skills | IAM policies, RLS, CLS, privacy transformations |
| **Orchestration** | 2 skills | Airflow and Dagster DAG generation and deployment |
| **Utilities** | 5 skills | Parquet conversion, comparisons, site generation |

## Supported Platforms

### Data Warehouses
- **BigQuery** — Native and Spark loaders
- **Snowflake** — JDBC connectivity
- **DuckDB** — Embedded SQL engine
- **PostgreSQL** — JDBC connectivity
- **Redshift** — JDBC connectivity
- **Databricks** — FS and Spark engines

### Processing Engines
- **Spark** — Distributed processing
- **Native** — Built-in Starlake engine
- **DuckDB** — Embedded analytical SQL

### Orchestration
- **Apache Airflow** — Python DAG generation
- **Dagster** — Asset-based orchestration

### Data Formats
CSV, JSON, XML, Parquet, Elasticsearch indices, Kafka topics

## How It Works

Starlake Skills integrates directly into Claude Code as a plugin. Once installed, you can ask Claude natural-language questions about any Starlake topic and receive expert guidance with production-ready configurations.

```
You: How do I load CSV files from GCS into BigQuery with deduplication?

Claude: [Uses the `load` skill to provide complete YAML configuration
         with UPSERT_BY_KEY_AND_TIMESTAMP write strategy, domain config,
         and schema definitions]
```

Each skill contains detailed knowledge about:
- CLI command syntax and all available options
- YAML configuration patterns with examples
- Write strategies, sink configurations, and engine-specific behaviors
- Best practices for production deployments
- Troubleshooting guidance

## Next Steps

- **[Quickstart](./quickstart.md)** — Install and use your first skill in 5 minutes
- **[Setup](./setup.md)** — Detailed installation and configuration options
- **[Skills Catalog](../0200-catalog/index.md)** — Browse all 48 skills by category
