---
sidebar_position: 2
title: Transformation
description: Skills for SQL and Python data transformations
---

# Transformation

2 skills for defining and running SQL/Python transformations with full support for write strategies, engine selection, and task dependencies.

## Skills

### transform

**Primary transformation skill.** Define SQL or Python transformations that read from loaded data and produce business-level datasets.

```
You: /transform Create a revenue summary transformation that joins orders and payments
```

**Key features:**
- SQL and Python task definitions
- Jinja2 templating in SQL
- Task dependency management
- Engine selection (Spark, Native, DuckDB)
- All write strategies supported

---

### job

**Run SQL/Python transformation jobs.** Functionally similar to `transform` with focus on the CLI execution aspects.

```
You: /job Run the revenue_summary transformation in the analytics domain
```

## Configuration Example

```yaml
# metadata/transform/analytics/revenue_summary.sl.yml
transform:
  name: revenue_summary
  database: "{{SL_DATABASE}}"
  domain: analytics
  sink:
    connectionRef: my-bigquery
    partition:
      - order_date
  writeStrategy:
    type: OVERWRITE
  tasks:
    - name: revenue_summary
      sql: revenue_summary.sql
      writeStrategy:
        type: UPSERT_BY_KEY
        key: [order_date, product_id]
      expectations:
        - name: count_check
          params:
            min: 1
```

```sql
-- metadata/transform/analytics/revenue_summary.sql
SELECT
    o.order_date,
    o.product_id,
    p.product_name,
    SUM(o.quantity * o.unit_price) as total_revenue,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    COUNT(*) as order_count
FROM {{ domain "sales" }}.orders o
JOIN {{ domain "products" }}.products p
    ON o.product_id = p.product_id
WHERE o.order_date >= '{{ start_date }}'
GROUP BY o.order_date, o.product_id, p.product_name
```

## Task Dependencies

Tasks within a transform can depend on each other:

```yaml
tasks:
  - name: staging_orders
    sql: staging_orders.sql
  - name: revenue_summary
    sql: revenue_summary.sql
    dependencies:
      - staging_orders
```
