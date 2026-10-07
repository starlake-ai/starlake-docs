---
id: skills-configure
sidebar_position: 1
title: Configure
description: Configuration guides for connections, warehouses, and environments
---

# Configuration

Starlake Skills helps you configure every aspect of your data pipeline — from database connections to environment-specific overrides.

## Configuration Skills

| Skill | Purpose |
|---|---|
| `config` | Full configuration reference (env vars, application structure, types, best practices) |
| `connection` | Create and modify database connections in `application.sl.yml` |
| `settings` | Application-level settings (parallelism, logging, engine options) |

## Core Configuration Files

| File | Purpose |
|---|---|
| `metadata/application.sl.yml` | Global config, connections, default settings |
| `metadata/env.sl.yml` | Environment variables and path definitions |
| `metadata/env.{ENV}.sl.yml` | Environment-specific overrides (DEV, PROD) |
| `metadata/types/default.sl.yml` | Data type definitions and mappings |

## Quick Examples

### Ask about configuration

```
You: /config How do I configure parallel loading with BigQuery as the target?
```

### Set up a connection

```
You: /connection Add a Snowflake connection with warehouse ANALYTICS_WH
```

### Configure environment variables

```
You: /config Set up environment overrides for DEV and PROD with different GCS buckets
```

## Schema Validation

All Starlake YAML files are validated against the official JSON Schema:

```
https://www.schemastore.org/starlake.json
```

Use the `validate` skill to check your configurations:

```
You: /validate Check all configuration files for schema compliance
```
