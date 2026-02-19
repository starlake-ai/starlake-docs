---
title: "Starlake Glossary"
description: "Definitions of key Starlake concepts: domains, schemas, load, transform, extract, orchestration, write strategies, expectations and more."
keywords: [starlake glossary, starlake concepts, data pipeline terminology, declarative data engineering]
slug: /glossary
sidebar_position: 600
---

import Head from '@docusaurus/Head';

<Head>
  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      "name": "Starlake Glossary",
      "description": "Key concepts and terminology used in Starlake data pipelines",
      "hasDefinedTerm": [
        {
          "@type": "DefinedTerm",
          "name": "Domain",
          "description": "A logical grouping of related tables in Starlake, equivalent to a database schema. Domains organize data by business area and are defined in YAML configuration files."
        },
        {
          "@type": "DefinedTerm",
          "name": "Schema",
          "description": "A YAML definition of a table's structure including column names, data types, validation rules, and privacy settings. Schemas drive how Starlake loads and validates incoming data."
        },
        {
          "@type": "DefinedTerm",
          "name": "Load",
          "description": "The process of ingesting files (CSV, JSON, Parquet, XML, etc.) into a data warehouse with automatic schema validation, type checking, and quality controls."
        },
        {
          "@type": "DefinedTerm",
          "name": "Autoload",
          "description": "A zero-configuration loading mode where Starlake infers schemas and orchestration logic from file names and directory structure, removing the need for explicit YAML definitions."
        },
        {
          "@type": "DefinedTerm",
          "name": "Transform",
          "description": "SQL or Python-based data transformation that produces derived tables from loaded data. Transforms are defined using standard SQL SELECT statements combined with YAML configuration."
        },
        {
          "@type": "DefinedTerm",
          "name": "Extract",
          "description": "The process of pulling data from JDBC/ODBC databases into files. Starlake supports full and incremental extraction with parallel processing."
        },
        {
          "@type": "DefinedTerm",
          "name": "Orchestration",
          "description": "Automated scheduling and dependency management of pipeline jobs. Starlake generates DAGs from predefined or custom templates for orchestrators like Airflow, Dagster, or Cloud Composer."
        },
        {
          "@type": "DefinedTerm",
          "name": "DAG",
          "description": "Directed Acyclic Graph representing the execution order of pipeline jobs. Starlake automatically infers DAGs from SQL task dependencies and generates orchestrator-specific code."
        },
        {
          "@type": "DefinedTerm",
          "name": "Write Strategy",
          "description": "Configuration that determines how data is written to the target table: APPEND, OVERWRITE, UPSERT_BY_KEY, UPSERT_BY_KEY_AND_TIMESTAMP, SCD2, DELETE_THEN_INSERT, or ADAPTATIVE."
        },
        {
          "@type": "DefinedTerm",
          "name": "Expectations",
          "description": "Data quality assertions evaluated during load or transform. Expectations define rules that incoming data must satisfy, such as non-null checks, value ranges, or custom SQL predicates."
        },
        {
          "@type": "DefinedTerm",
          "name": "Metrics",
          "description": "Statistical measurements computed during data ingestion, including continuous metrics (min, max, mean) and discrete metrics (count, frequency). Used for data profiling and monitoring."
        },
        {
          "@type": "DefinedTerm",
          "name": "Connection",
          "description": "A named configuration for connecting to a database or storage system, defined in application.sl.yml. Connections specify JDBC URLs, drivers, and authentication options."
        },
        {
          "@type": "DefinedTerm",
          "name": "Environment Variables",
          "description": "Configuration values that vary between deployment environments (dev, staging, production). Starlake uses environment files to manage settings like database URLs and credentials."
        },
        {
          "@type": "DefinedTerm",
          "name": "Native Load",
          "description": "A loading mode that uses the data warehouse's built-in loading mechanism (e.g., BigQuery Load, Snowflake COPY INTO) instead of Spark, for optimal performance on simple ingestion tasks."
        },
        {
          "@type": "DefinedTerm",
          "name": "Lineage",
          "description": "Automatic tracking of data dependencies between tables and transforms. Starlake detects column-level and table-level lineage from SQL queries without manual annotation."
        },
        {
          "@type": "DefinedTerm",
          "name": "Bootstrap",
          "description": "A CLI command that creates a new Starlake project with the default directory structure and configuration files needed to start building pipelines."
        },
        {
          "@type": "DefinedTerm",
          "name": "SCD2",
          "description": "Slowly Changing Dimension Type 2, a write strategy that preserves the full history of record changes by maintaining start and end timestamps for each version of a row."
        },
        {
          "@type": "DefinedTerm",
          "name": "Partition Column",
          "description": "A column designated for splitting data extraction or storage into partitions. In extraction, it enables parallel reads; in loading, it controls how data is physically organized in the warehouse."
        },
        {
          "@type": "DefinedTerm",
          "name": "Sink",
          "description": "Target table configuration that defines physical storage properties such as partitioning columns, clustering keys, and table-level options for the destination data warehouse."
        },
        {
          "@type": "DefinedTerm",
          "name": "Declarative Data Engineering",
          "description": "A methodology where pipelines are defined by describing the desired outcome in YAML and SQL (the 'what'), rather than writing imperative code (the 'how'). Starlake implements this paradigm, acting as 'Terraform for Data Pipelines'."
        }
      ]
    })}
  </script>
</Head>

# Starlake Glossary

A reference of key concepts and terminology used throughout Starlake and its documentation.

---

## Declarative Data Engineering

A methodology where data pipelines are defined by describing the desired outcome in **YAML and SQL** (the "what"), rather than writing imperative code (the "how"). Starlake implements this paradigm, acting as "Terraform for Data Pipelines" -- you declare your schemas, transforms, and orchestration, and Starlake generates the execution code automatically.

[Learn more in the Overview](/)

## Domain

A logical grouping of related tables in Starlake, equivalent to a database schema or a business area. Domains are defined using a `_config.sl.yml` file within a directory and can carry shared metadata (format, write strategy, scheduling) that applies to all tables within them.

[Learn more about Domains](guides/load/tutorial)

## Schema (Table Schema)

A YAML definition of a table's structure, including column names, data types, validation rules, privacy settings, and required constraints. Schemas drive how Starlake validates and loads incoming data. They are defined in `.sl.yml` files under the `metadata/load` directory.

[Learn more about Schemas](guides/load/tutorial)

## Load

The process of ingesting files (CSV, TSV, JSON, XML, Fixed-width, Parquet, Avro) into a data warehouse. Starlake automatically validates data against the declared schema, applies privacy rules, and writes to the target table using the configured write strategy.

[Learn more about Load](guides/load/tutorial)

## Autoload

A zero-configuration loading mode where Starlake infers schemas and orchestration logic directly from file names and directory structure. Autoload removes the need for explicit YAML schema definitions, making it the fastest way to get data into a warehouse.

[Learn more about Autoload](guides/load/autoload)

## Transform

A SQL or Python-based data transformation step that produces derived tables from previously loaded or transformed data. Transforms are defined using standard SQL `SELECT` statements combined with YAML configuration. Starlake automatically applies the correct merge strategy (`INSERT OVERWRITE` or `MERGE INTO`) based on the write strategy.

[Learn more about Transform](guides/transform/tutorial)

## Extract

The process of pulling data from any JDBC/ODBC-compliant database (PostgreSQL, MySQL, SQL Server, Oracle, DuckDB, etc.) into files. Starlake supports full and incremental extraction, parallel reads via partition columns, and automatic schema evolution detection.

[Learn more about Extract](guides/extract/tutorial)

## Connection

A named configuration entry in `application.sl.yml` that defines how to connect to a database or storage system. Connections specify the JDBC URL, driver class, and any authentication options. They are referenced by name (`connectionRef`) in extract and load configurations.

[Learn more about Connections](guides/extract/tutorial)

## Write Strategy

A configuration property (`metadata.writeStrategy`) that determines how data is written to the target table. Starlake supports several strategies, each suited to different use cases.

[Learn more about Write Strategies](guides/load/write-strategies)

### APPEND

Inserts all incoming rows into the table without modifying existing data. If the table does not exist, it is created automatically.

### OVERWRITE

Replaces all existing rows in the table with the incoming data. Useful for dimension tables or complete snapshots.

### UPSERT_BY_KEY

Merges incoming rows with existing data based on a key column. Rows with matching keys are updated; new rows are inserted.

### UPSERT_BY_KEY_AND_TIMESTAMP

Similar to UPSERT_BY_KEY, but only updates rows when the incoming timestamp is newer than the existing one. This prevents stale data from overwriting more recent records.

### DELETE_THEN_INSERT

Deletes rows in the target table for which matching keys exist in the incoming data, then inserts all incoming rows. Useful when you need a clean replacement of specific records.

### SCD2

Slowly Changing Dimension Type 2 -- a write strategy that preserves the full history of record changes. Each version of a row is tracked with start (`sl_start_ts`) and end (`sl_end_ts`) timestamps, enabling point-in-time queries across the entire history of a record.

[Learn more about SCD2](guides/load/write-strategies#scd2)

### ADAPTATIVE

A dynamic write strategy determined at runtime based on criteria such as the day of the week, file size, or patterns in the file name. Allows switching between strategies (e.g., APPEND on weekdays, OVERWRITE on Sundays) without changing the pipeline code.

[Learn more about Adaptive Write Strategy](guides/load/write-strategies)

## Orchestration

Automated scheduling and dependency management of pipeline jobs. Starlake analyzes dependencies between SQL tasks and generates DAGs using predefined or custom templates for orchestrators like Apache Airflow, Dagster, or Google Cloud Composer. No orchestration code needs to be written manually.

[Learn more about Orchestration](guides/orchestrate/tutorial)

## DAG

Directed Acyclic Graph -- a representation of the execution order of pipeline jobs where each node is a task and edges represent dependencies. Starlake automatically infers DAGs from SQL task dependencies and generates orchestrator-specific code (e.g., Airflow Python files) from configurable templates.

[Learn more about DAGs](guides/orchestrate/tutorial)

## Expectations

Data quality assertions that are evaluated during load or transform operations. Expectations define rules that incoming data must satisfy, such as non-null checks, value ranges, uniqueness constraints, or custom SQL predicates. Rows that fail expectations can be rejected or flagged.

[Learn more about Expectations](guides/load/expectations)

## Metrics

Statistical measurements computed during data ingestion for data profiling and monitoring. Metrics can be continuous (min, max, mean, standard deviation) or discrete (count, frequency distribution). They provide visibility into data quality trends over time.

[Learn more about Metrics](guides/load/metrics)

## Native Load

A loading mode that leverages the data warehouse's built-in loading mechanism (e.g., BigQuery Load API, Snowflake `COPY INTO`) instead of Spark. Native Load provides optimal performance for straightforward ingestion tasks that do not require complex transformations or validations during load.

[Learn more about Native Load](guides/load/tutorial)

## Lineage

Automatic tracking of data dependencies between tables and transforms. Starlake detects both column-level and table-level lineage by parsing SQL queries, without requiring manual annotation. Lineage information powers DAG generation and helps teams understand the impact of changes.

[Learn more about Lineage](guides/transform/tutorial)

## Environment Variables

Configuration values that vary between deployment environments (development, staging, production). Starlake supports environment-specific files (e.g., `env.sl.yml`) that override default settings, enabling the same pipeline code to run across different environments with different database URLs, credentials, or warehouse targets.

[Learn more about Environment Variables](guides/project-setup/environment)

## Bootstrap

A CLI command (`starlake bootstrap`) that creates a new Starlake project with the standard directory structure (`metadata/`, `datasets/`, `incoming/`) and default configuration files. Bootstrap is the recommended starting point for any new Starlake project.

[Learn more about Bootstrap](guides/project-setup/starlake-project-setup)

## Partition Column

A column used to split data during extraction or to organize data physically in the target warehouse. In extraction, specifying a partition column enables parallel reads from the source database, significantly improving performance. In loading, it controls how data is partitioned on disk for efficient querying.

[Learn more about Partition Columns](guides/extract/tutorial)

## Sink

Target table configuration that defines physical storage properties in the destination data warehouse. Sink properties include partitioning columns, clustering keys, and warehouse-specific options that optimize query performance and storage costs.

[Learn more about Sink Configuration](guides/load/tutorial)

## Infer Schema

A CLI command (`starlake infer-schema`) that analyzes sample data files and automatically generates the corresponding YAML schema definition. Infer Schema detects column names, data types, separators, and encoding, accelerating the onboarding of new data sources.

[Learn more about Infer Schema](guides/load/tutorial)
