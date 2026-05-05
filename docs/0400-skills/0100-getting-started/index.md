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
- **BigQuery**: Native and Spark loaders
- **Snowflake**: JDBC connectivity
- **DuckDB**: Embedded SQL engine
- **PostgreSQL**: JDBC connectivity
- **Redshift**: JDBC connectivity
- **Databricks**: FS and Spark engines

### Processing Engines
- **Spark**: Distributed processing
- **Native**: Built-in Starlake engine
- **DuckDB**: Embedded analytical SQL

### Orchestration
- **Apache Airflow**: Python DAG generation
- **Dagster**: Asset-based orchestration

### Data Formats
CSV, JSON, XML, Parquet, Elasticsearch indices, Kafka topics

## Skills and Starflow: Two Ways to Work

Starlake Skills provides two complementary approaches depending on the scope of your work:

### Starlake Skills: Direct Access to Every Command

Skills integrate directly into Claude Code as a plugin. Each of the 48 skills gives you deep expertise on a specific Starlake capability — CLI syntax, YAML configuration, write strategies, engine-specific behaviors, and production best practices.

Use skills when you have a **targeted task**: loading a file, writing a transformation, generating a DAG, or configuring a connection.

```
You: How do I load CSV files from GCS into BigQuery with deduplication?

Claude: [Uses the `load` skill to provide complete YAML configuration
         with UPSERT_BY_KEY_AND_TIMESTAMP write strategy, domain config,
         and schema definitions]
```

### Starflow: Guided Methodology for End-to-End Projects

[Starflow](../0500-starflow/index.md) is an optional guided methodology layer built on top of Starlake Skills. Where individual skills answer *"how do I do X?"*, Starflow answers *"what should I do next and why?"*

Starflow organizes data pipeline projects into four phases — **Discovery**, **Architecture**, **Pipeline Design**, and **Implementation**: each with dedicated skills and specialized agent personas that guide you through the full lifecycle.

Use Starflow when you're tackling a **broader initiative**: starting a new data platform, migrating from legacy ETL, onboarding a team, or reviewing an existing architecture.

```
You: /starflow-data-architect Design a data platform for our e-commerce analytics

Winston: [Guides you through architecture decisions — layers, engines,
          storage, governance — then hands off to implementation skills]
```

### How They Fit Together

| | **Starlake Skills** | **Starflow** |
|---|---|---|
| **Scope** | Single task or command | Multi-step project lifecycle |
| **Approach** | Direct — ask and get an answer | Guided — phased workflow with recommendations |
| **Best for** | Loading, transforming, configuring, deploying | Discovery, architecture, planning, reviews |
| **Personas** | None — you drive | 5 agent personas (Lea, Winston, Amelia, Quinn, Max) |

Starflow skills call on the underlying Starlake Skills during implementation, so the two layers work together seamlessly. You can start with Starflow for planning and architecture, then drop into individual skills for hands-on configuration — or skip Starflow entirely and use skills directly for quick tasks.

## Next Steps

- **[Quickstart](./quickstart.md)**: Install and use your first skill in 5 minutes
- **[Setup](./setup.md)**: Detailed installation and configuration options
- **[Skills Catalog](../0200-catalog/index.md)**: Browse all 48 skills by category
- **[Starflow Method](../0500-starflow/index.md)**: Guided methodology for end-to-end projects
