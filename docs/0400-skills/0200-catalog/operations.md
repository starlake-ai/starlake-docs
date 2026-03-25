---
sidebar_position: 7
title: Operations
description: Skills for validation, monitoring, metrics, and runtime operations
---

# Operations

8 skills for managing, monitoring, and maintaining your Starlake deployment.

## Skills

### validate

**Validate project configuration.** Checks your entire project for YAML schema compliance, broken references, and configuration errors.

```
You: /validate Check my project for errors and suggest fixes
```

**Validates:**
- YAML schema compliance against [starlake.json](https://www.schemastore.org/starlake.json)
- Connection references exist
- Domain and table configurations are complete
- Type definitions are valid
- Environment variables resolve correctly

---

### metrics

**Metrics collection and management.** Configure and query data pipeline metrics including row counts, processing times, and data quality scores.

```
You: /metrics Set up metrics collection for all load operations
```

---

### freshness

**Data freshness monitoring.** Track how current your data is and alert when tables go stale.

```
You: /freshness Configure freshness checks for the analytics domain with a 4-hour SLA
```

---

### gizmosql

**GizmoSQL process management.** Manage DuckLake SQL endpoints for serving data via SQL interfaces.

```
You: /gizmosql Set up a GizmoSQL endpoint for the analytics database
```

**Capabilities:**
- Start/stop SQL endpoints
- Configure connection pooling
- Manage DuckDB-based SQL serving
- Monitor active queries

---

### migrate

**Schema migration.** Manage database schema changes and migrations across environments.

```
You: /migrate Apply schema changes to update the customers table in production
```

---

### console

**Console access and management.** Access the Starlake interactive console for ad-hoc operations.

```
You: /console How do I access the Starlake console for my BigQuery project?
```

---

### serve

**Data serving configuration.** Set up APIs and endpoints for serving data from your pipeline.

```
You: /serve Configure a REST endpoint for the product catalog
```

---

### settings

**Application settings management.** Configure global application settings including logging, parallelism, and engine options.

```
You: /settings Configure parallel loading with 4 concurrent jobs
```
