---
title: "Query based extraction"
id: "query-based-extraction"
icon: "starlake"
level: "Beginner"
tags: ["Extract"]
description: "A solution to not export the whole table"
---

## Query-Based Extraction

Query extraction allows you to extract data and schema not from an entire table, but from a **custom SQL query**.  
This is useful when you want to:

- Join multiple tables before extracting
- Filter rows at source
- Select only relevant columns
- Apply transformations during extraction
- Reduce extract file size and cost

Instead of extracting the whole table, Starlake runs your query and exports the result.

---

### How to Configure Query Extraction in the GUI

1. Open the **Extract** tab.
2. Select or create an extraction configuration.
3. Edit the generated `.sl.yml` file.
4. Inside a table entry, add a `sql` field containing your query.

Example:

```yaml
version: 1
extract:
  connectionRef: "my_database_connection"
  jdbcSchemas:
    - schema: "analytics"
      tables:
        - name: "completed_orders"
          sql: "SELECT order_id, customer_id, total_amount, order_date FROM analytics.orders WHERE status = 'COMPLETED'"
```