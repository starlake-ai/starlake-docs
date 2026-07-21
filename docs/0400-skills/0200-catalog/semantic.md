---
sidebar_position: 5.5
title: Semantic Layer
description: Skills for authoring business semantic models consumed by BI tools and AI agents
---

# Semantic Layer

## semantic

**Author semantic models in `metadata/semantic/`.** A semantic model describes your warehouse in business terms: logical tables with dimensions, time dimensions, facts, metrics, and filters; relationships between tables; and verified queries. It is the layer BI tools and AI agents query by business vocabulary ("AOV", "purchase date") instead of column names.

```
You: /semantic Create a semantic model for my orders and customers tables
```

The format is aligned with the Snowflake semantic model specification (consumed by Cortex Analyst and convertible to native Snowflake semantic views). For vendor-neutral interchange, the same modeling concepts are being standardized as **Apache Ossie (Incubating)**, formerly Open Semantic Interchange, with reference converters between the two formats.

### Model Structure

```yaml
# metadata/semantic/ecommerce_analytics.yaml
name: ecommerce_analytics
description: E-commerce analytics model
tables:
  - name: orders
    base_table: { database: ANALYTICS_DB, schema: ECOMMERCE, table: ORDERS }
    dimensions:
      - name: order_status
        expr: ORDER_STATUS
        synonyms: ["status"]
        is_enum: true
    time_dimensions:
      - name: order_date
        expr: ORDER_DATE
        data_type: DATE
    facts:
      - name: order_total
        expr: ORDER_TOTAL
        data_type: NUMBER
    metrics:
      - name: avg_order_value
        synonyms: ["AOV"]
        expr: AVG(order_total)
relationships:
  - name: orders_to_customers
    left_table: orders
    right_table: customers
    relationship_columns:
      - { left_column: customer_id, right_column: customer_id }
    join_type: left_outer
    relationship_type: many_to_one
verified_queries:
  - name: top_customers_by_revenue
    question: Who are the top 10 customers by total revenue?
    sql: |
      SELECT ...
```

### Authoring Rules

- Every `expr` must reference physical columns of its `base_table`: re-check semantic models after schema changes.
- Synonyms and descriptions are what make AI and BI consumption work: a model without them is a schema dump, not a semantic layer.
- Columns carrying privacy annotations (`HIDE`, `SHA256`, `MD5`, `AES`) must not appear as dimensions or in `sample_values`.
- Only mark `verified_queries` you have actually executed.

### Designing Models with Starflow

For a guided path from pipeline tables to a complete semantic model (column classification, vocabulary coaching, privacy gating, relationships from foreign keys), use the [`starflow-semantic-model-design`](../0500-starflow/index.md) workflow skill.
