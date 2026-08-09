---
title: "Incremental extraction"
id: "incremental-extraction"
icon: "starlake"
level: "Beginner"
tags: ["Extract"]
description: "extract data that has changed since the last extraction"
---

## Incremental Extraction

Incremental extraction allows you to extract **only new or updated records** since the last extraction—rather than exporting the full dataset every time.

This is ideal when:

- Your tables are large
- Only a small portion of data changes regularly
- You want to optimize storage and processing
- You run scheduled extractions

Instead of repeatedly extracting millions of rows, Starlake picks up **only what has changed**.

---

### How It Works

Starlake tracks the highest value previously extracted from a column called the **partitionColumn**.

During the next extraction, only rows with a greater value are exported.

Supported column types include:

- timestamps
- dates
- numeric sequences (IDs, auto-increment keys)

---

### Enabling Incremental Extraction in the GUI

1. Go to the **Extract** tab.
2. Create or open an existing extract configuration.
3. Edit the generated `.sl.yml` file.
4. Add a `partitionColumn` under the target table.

Example:

```yaml
version: 1
extract:
  connectionRef: "my_database_connection"
  jdbcSchemas:
    - schema: "public"
      tables:
        - name: "transactions"
          partitionColumn: "updated_at"
```
