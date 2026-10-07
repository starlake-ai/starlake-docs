---
sidebar_position: 3
title: Extraction
description: Skills for extracting schemas and data from databases
---

# Extraction

5 skills for extracting schemas, data, and scripts from existing databases — essential for migration and reverse engineering.

## Skills

### extract

**Combined schema and data extraction.** The all-in-one extraction skill that handles both structure and data.

```
You: /extract Extract the complete analytics schema from Snowflake including data samples
```

---

### extract-schema

**JDBC schema extraction** with support for custom remarks, column selection, and filtering. Generates Starlake YAML configurations from existing database schemas.

```
You: /extract-schema Reverse-engineer my PostgreSQL analytics schema into Starlake YAML
```

**Key features:**
- Extracts table structures, column types, and constraints
- Custom remark handling for documentation
- Column filtering and selection
- Generates ready-to-use domain and table YAML files

---

### extract-data

**Extract data to files.** Export data from databases to CSV, JSON, or Parquet files.

```
You: /extract-data Export the customers table from BigQuery to Parquet files
```

---

### extract-bq-schema

**BigQuery-specific schema extraction.** Optimized for BigQuery's nested and repeated field structures.

```
You: /extract-bq-schema Extract all table schemas from the analytics dataset in BigQuery
```

---

### extract-script

**Generate extraction scripts.** Creates reusable extraction configurations and shell scripts.

```
You: /extract-script Generate an extraction script for nightly exports from Snowflake
```

## Example: Reverse-Engineering a Database

```yaml
# metadata/extract/analytics.sl.yml
extract:
  connectionRef: my-snowflake
  jdbcSchemas:
    - schema: ANALYTICS
      tables:
        - name: CUSTOMERS
          columns:
            - name: "*"
        - name: ORDERS
          columns:
            - name: "*"
      tableTypes:
        - TABLE
        - VIEW
```

The extraction generates Starlake-compatible YAML that you can immediately use for ingestion or transformation pipelines.
