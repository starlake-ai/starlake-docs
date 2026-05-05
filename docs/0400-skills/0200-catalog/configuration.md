---
sidebar_position: 11
title: Configuration
description: Skills for configuration reference and database connections
---

# Configuration

2 skills for understanding configuration options and setting up database connections.

## Skills

### config

**Full configuration reference.** Comprehensive guide to environment variables, application structure, attribute types, and best practices.

```
You: /config Show me all available environment variables for configuring Starlake
```

**Covers:**
- **Environment variables**: `SL_ROOT`, `SL_ENV`, `SL_DATASETS`, and component-specific variables
- **Application configuration**: Complete `application.sl.yml` structure with write formats, load strategies, timezone, storage paths, audit, connections, expectations, metrics
- **Attribute types catalog**: Primitive types (string, int, long, decimal, boolean), date/time formats (ISO, RFC 1123), and custom types
- **Storage patterns**: S3/MinIO/SeaweedFS configuration for Spark and DuckDB
- **Best practices**: Variable substitution, environment separation, custom types, partitioning, privacy transformations

---

### connection

**Database connection configuration.** Set up and manage connections to all supported data platforms.

```
You: /connection Configure a Snowflake connection with OAuth authentication
```

**Supported databases:**

| Database | Modes |
|---|---|
| BigQuery | Native, Spark |
| Snowflake | JDBC, OAuth, Spark connector |
| DuckDB | Basic, S3, MotherDuck, DuckLake |
| PostgreSQL | Native, Spark |
| MySQL/MariaDB | JDBC |
| Amazon Redshift | Native, Spark |
| Databricks | JDBC |
| Apache Spark | Local/file system |
| Elasticsearch | REST |
| Kafka | Producer/Consumer |

**Key features:**
- Connection pooling strategies per database type
- Environment variable patterns for sensitive values
- Multi-database project configurations
- DuckLake secret setup for PostgreSQL + GCS/S3
- Connection testing via CLI
