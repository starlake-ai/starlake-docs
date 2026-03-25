---
sidebar_position: 2
title: Warehouses
description: Warehouse-specific configuration guides
---

# Warehouse Configuration

Each data warehouse has specific configuration options and engine behaviors. Starlake Skills provides guidance tailored to your target platform.

## BigQuery

**Engine:** Native or Spark
**Connection type:** `BQ`

```yaml
application:
  connections:
    bigquery:
      type: BQ
      options:
        location: EU
        authType: APPLICATION_DEFAULT
  loader: native  # or spark
```

**BigQuery-specific features:**
- Partitioned tables (time, range, ingestion-time)
- Clustered tables
- Materialized views
- Streaming inserts
- Native MERGE for upsert strategies

---

## Snowflake

**Engine:** Spark (via JDBC)
**Connection type:** `JDBC`

```yaml
application:
  connections:
    snowflake:
      type: JDBC
      options:
        url: "jdbc:snowflake://account.snowflakecomputing.com"
        user: "{{SF_USER}}"
        password: "{{SF_PASSWORD}}"
        warehouse: "{{SF_WAREHOUSE}}"
        db: "{{SF_DATABASE}}"
```

**Snowflake-specific features:**
- Warehouse auto-scaling
- Time travel for data recovery
- Zero-copy cloning
- Native app integration

---

## DuckDB

**Engine:** Native (JDBC)
**Connection type:** `JDBC`

```yaml
application:
  connections:
    duckdb:
      type: JDBC
      options:
        url: "jdbc:duckdb:/path/to/db.duckdb"
```

**DuckDB-specific features:**
- In-memory processing
- Direct Parquet/CSV reading
- GizmoSQL endpoint serving
- Embedded analytics

---

## PostgreSQL

**Engine:** Spark (via JDBC)
**Connection type:** `JDBC`

```yaml
application:
  connections:
    postgres:
      type: JDBC
      options:
        url: "jdbc:postgresql://host:5432/dbname"
        user: "{{PG_USER}}"
        password: "{{PG_PASSWORD}}"
```

---

## Redshift

**Engine:** Spark (via JDBC)
**Connection type:** `JDBC`

```yaml
application:
  connections:
    redshift:
      type: JDBC
      options:
        url: "jdbc:redshift://cluster.region.redshift.amazonaws.com:5439/dbname"
        user: "{{RS_USER}}"
        password: "{{RS_PASSWORD}}"
```

---

## Databricks

**Engine:** Spark or FS
**Connection type:** `JDBC` or `FS`

```yaml
application:
  connections:
    databricks:
      type: JDBC
      options:
        url: "jdbc:databricks://workspace.azuredatabricks.net:443/default"
        token: "{{DATABRICKS_TOKEN}}"
```

## Engine Comparison

| Feature | Spark | Native | DuckDB |
|---|---|---|---|
| Distributed processing | Yes | No | No |
| In-memory analytics | Limited | Yes | Yes |
| Cloud storage direct read | Yes | Yes | Yes |
| Write strategies | All | All | All |
| Best for | Large-scale ETL | Simple pipelines | Dev/test, embedded |
