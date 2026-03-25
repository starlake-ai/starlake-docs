---
sidebar_position: 1
title: Connections
description: Configure database connections for all supported platforms
---

# Connections

Database connections are defined in `metadata/application.sl.yml` and referenced throughout your pipeline configuration.

## Connection Types

### BigQuery (`BQ`)

```yaml
connections:
  my-bigquery:
    type: BQ
    options:
      location: EU
      authType: APPLICATION_DEFAULT
      #authType: SERVICE_ACCOUNT_JSON_KEYFILE
      #jsonKeyfile: "/path/to/keyfile.json"
```

**Authentication methods:**
- `APPLICATION_DEFAULT` — Uses Google Cloud default credentials
- `SERVICE_ACCOUNT_JSON_KEYFILE` — Explicit service account key

### Snowflake (`JDBC`)

```yaml
connections:
  my-snowflake:
    type: JDBC
    options:
      url: "jdbc:snowflake://account.snowflakecomputing.com"
      user: "{{SNOWFLAKE_USER}}"
      password: "{{SNOWFLAKE_PASSWORD}}"
      warehouse: COMPUTE_WH
      db: ANALYTICS
      schema: PUBLIC
      role: SYSADMIN
```

### DuckDB (`JDBC`)

```yaml
connections:
  my-duckdb:
    type: JDBC
    options:
      url: "jdbc:duckdb:/path/to/database.db"
      # Or in-memory:
      # url: "jdbc:duckdb:"
```

### PostgreSQL (`JDBC`)

```yaml
connections:
  my-postgres:
    type: JDBC
    options:
      url: "jdbc:postgresql://localhost:5432/mydb"
      user: "{{PG_USER}}"
      password: "{{PG_PASSWORD}}"
```

### Redshift (`JDBC`)

```yaml
connections:
  my-redshift:
    type: JDBC
    options:
      url: "jdbc:redshift://cluster.region.redshift.amazonaws.com:5439/mydb"
      user: "{{REDSHIFT_USER}}"
      password: "{{REDSHIFT_PASSWORD}}"
```

### Elasticsearch (`ES`)

```yaml
connections:
  my-elasticsearch:
    type: ES
    options:
      nodes: "localhost:9200"
      #user: "{{ES_USER}}"
      #password: "{{ES_PASSWORD}}"
```

### Kafka (`KAFKA`)

```yaml
connections:
  my-kafka:
    type: KAFKA
    options:
      bootstrapServers: "localhost:9092"
      schemaRegistryUrl: "http://localhost:8081"
```

### File System (`FS`)

```yaml
connections:
  my-gcs:
    type: FS
    options:
      path: "gs://my-bucket/data"
  my-s3:
    type: FS
    options:
      path: "s3://my-bucket/data"
  my-local:
    type: FS
    options:
      path: "/data/warehouse"
```

## Environment Variable Substitution

Use `{{VARIABLE}}` syntax to inject secrets from environment variables:

```yaml
connections:
  production:
    type: JDBC
    options:
      url: "{{DB_URL}}"
      user: "{{DB_USER}}"
      password: "{{DB_PASSWORD}}"
```

Define variables in `env.sl.yml` or set them as OS environment variables.

## Referencing Connections

Use `connectionRef` in domain, table, or transform configurations:

```yaml
load:
  metadata:
    sink:
      connectionRef: my-bigquery
```

```yaml
transform:
  sink:
    connectionRef: my-snowflake
```
