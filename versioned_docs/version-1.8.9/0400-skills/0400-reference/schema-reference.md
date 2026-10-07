---
sidebar_position: 2
title: Schema Reference
description: YAML configuration schema reference for Starlake
---

# Schema Reference

All Starlake YAML configuration files are validated against the official JSON Schema.

## JSON Schema

```
https://www.schemastore.org/starlake.json
```

Use this schema in your IDE for autocompletion and validation:

```yaml
# VS Code settings.json
{
  "yaml.schemas": {
    "https://www.schemastore.org/starlake.json": "**/*.sl.yml"
  }
}
```

## Configuration Objects

### AppConfigV1

Top-level application configuration in `application.sl.yml`:

```yaml
application:
  connections: {}        # Database connections
  loader: native         # Default engine (native, spark)
  privacy: {}            # Global privacy settings
  metadata: {}           # Global metadata defaults
  audit: {}              # Audit logging configuration
```

### LoadConfigV1

Domain and table configuration for data ingestion:

```yaml
load:
  metadata:
    mode: FILE           # FILE or STREAM
    format: DSV          # DSV, JSON, XML, PARQUET, etc.
    withHeader: true
    separator: ","
    encoding: UTF-8
    writeStrategy:
      type: APPEND       # APPEND, OVERWRITE, UPSERT_BY_KEY, etc.
    sink:
      connectionRef: my-connection
```

### TableConfigV1

Table schema definition:

```yaml
table:
  name: my_table
  pattern: "my_table-.*.csv"
  attributes:
    - name: id
      type: long
      required: true
    - name: name
      type: string
    - name: created_at
      type: timestamp
  expectations: []
```

### TransformConfigV1

Transformation task configuration:

```yaml
transform:
  name: my_transform
  database: "{{SL_DATABASE}}"
  domain: analytics
  tasks:
    - name: task_name
      sql: task_name.sql
      writeStrategy:
        type: OVERWRITE
      sink:
        connectionRef: my-connection
```

### ConnectionV1

Database connection definition:

```yaml
connections:
  connection_name:
    type: BQ              # BQ, JDBC, FS, ES, KAFKA
    options:
      key: value
```

### ExtractConfigV1

Schema and data extraction configuration:

```yaml
extract:
  connectionRef: my-connection
  jdbcSchemas:
    - schema: SCHEMA_NAME
      tables:
        - name: TABLE_NAME
          columns:
            - name: "*"
```

## Data Types

Standard Starlake types defined in `metadata/types/default.sl.yml`:

| Type | Description | Example |
|---|---|---|
| `string` | Text data | Names, emails |
| `long` | 64-bit integer | IDs, counts |
| `integer` | 32-bit integer | Small numbers |
| `double` | 64-bit float | Measurements |
| `decimal` | Arbitrary precision | Currency |
| `boolean` | True/false | Flags |
| `date` | Date without time | `2024-01-15` |
| `timestamp` | Date with time | `2024-01-15T10:30:00` |
| `bytes` | Binary data | Files, images |
| `struct` | Nested structure | Complex objects |
| `array` | List of values | Tags, categories |

## Write Strategies

| Strategy | Description |
|---|---|
| `APPEND` | Insert new records, no dedup |
| `OVERWRITE` | Replace entire table |
| `UPSERT_BY_KEY` | Update by primary key, insert new |
| `UPSERT_BY_KEY_AND_TIMESTAMP` | Update by key + timestamp |
| `SCD2` | Slowly changing dimension type 2 |
| `DELETE_THEN_INSERT` | Delete matching, then insert |
| `OVERWRITE_BY_PARTITION` | Replace specific partitions only |

## External Resources

- [Official Starlake Documentation](https://docs.starlake.ai)
- [Starlake GitHub](https://github.com/starlake-ai/starlake)
- [Starlake Examples](https://github.com/starlake-ai/starlake-examples)
- [Blog](https://blog.starlake.ai)
