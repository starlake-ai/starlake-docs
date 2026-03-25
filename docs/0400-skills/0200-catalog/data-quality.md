---
sidebar_position: 5
title: Data Quality
description: Skills for data quality expectations and validation
---

# Data Quality

## expectations

**Expectation syntax, Jinja2 macros, and validation patterns.** Define data quality checks that run during ingestion and transformation.

```
You: /expectations Set up data quality checks for my customers table
```

### Built-in Macros

Starlake provides pre-built Jinja2 macros for common validations:

| Macro | Description |
|---|---|
| `expect_count_between(min, max)` | Row count within range |
| `expect_column_not_null(col)` | No null values in column |
| `expect_column_unique(col)` | All values unique |
| `expect_column_values_in_set(col, values)` | Values within allowed set |
| `expect_column_values_between(col, min, max)` | Numeric range check |
| `expect_column_mean_between(col, min, max)` | Average within range |
| `expect_column_match_regex(col, pattern)` | Regex pattern match |

### Configuration Example

```yaml
# In your table configuration
table:
  name: customers
  expectations:
    - name: row_count
      sql: "{{ expect_count_between(1, 1000000) }}"
      level: ERROR
    - name: email_not_null
      sql: "{{ expect_column_not_null('email') }}"
      level: ERROR
    - name: email_format
      sql: "{{ expect_column_match_regex('email', '^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$') }}"
      level: WARN
    - name: unique_ids
      sql: "{{ expect_column_unique('customer_id') }}"
      level: ERROR
```

### Expectation Levels

| Level | Behavior |
|---|---|
| `ERROR` | Fails the load/transform, records sent to rejected area |
| `WARN` | Logs a warning, continues processing |

### Custom Expectations

Write custom SQL expectations for complex validation logic:

```yaml
expectations:
  - name: revenue_positive
    sql: |
      SELECT COUNT(*) = 0
      FROM {{table}}
      WHERE total_revenue < 0
    level: ERROR
```
