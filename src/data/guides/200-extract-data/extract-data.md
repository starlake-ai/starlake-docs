---
title: "Extract Data"
id: "extract-data"
icon: "starlake"
level: "Beginner"
tags: ["Extract", "Starlake"]
description: "Learn how to configure and run data extraction jobs directly from the Starlake GUI."
hide_table_of_contents: false
---

## Extract Data 

Starlake allows you to extract tables from any connected database directly through the graphical interface.  
This guide shows how to create an extract configuration, edit its options, and run an extraction job.

## Open the Extract Section

1. In the Starlake sidebar, click **Extract**.
2. Click **“Add** to create your first extraction.

You will be prompted to choose:
- A name for your extract configuration    

Once created, Starlake automatically opens the generated `.sl.yml` file.

## Understanding the Generated Extract Configuration

When you create a new extract config from the GUI, Starlake generates a file.
A default configuration looks like:

```yaml
version: 1
extract:
  connectionRef: "duckdb"
  jdbcSchemas:
    - schema: "starbake"
      tables:
        - name: "*"
      tableTypes:
        - "TABLE"
        # - "VIEW"
        # - "SYSTEM TABLE"
```

This configuration tells Starlake:

1. Which database connection to use (connectionRef)
2. Which schemas to extract
3. Which tables inside the schema
4. Which table types to include

You can edit this file directly from the GUI.


## Options You Can Configure

### Connection Reference (connectionRef)

Defines which database Starlake should connect to.
```yaml
connectionRef: "duckdb"
connectionRef: "bigquery"
connectionRef: "snowflake"
connectionRef: "postgres"
```

### Selecting Schemas (jdbcSchemas)

You may extract from one schema or several.
```yaml
jdbcSchemas:
  - schema: "starbake"
  - schema: "sales"
```

### Selecting Tables

You have three options:

1. Extract all tables
```yaml
tables:
  - name: "*"
```

2. Extract specific tables
```yaml
tables:
  - name: "order"
  - name: "order_line"
```

3. Use patterns
```yaml
tables:
  - name: "prod*"
```

### Table Types

Extract only certain object types.

Common options:

1. "TABLE"
2. "VIEW"
3. "SYSTEM TABLE"

Example:
```yaml
tableTypes:
  - "TABLE"
  - "VIEW"
```

### Filtering Columns (Advanced)

You can restrict which columns to extract:
```yaml
tables:
  - name: "order"
    columns:
      - "order_id"
      - "status"
```

### Row Filtering (Advanced)

Extract only a subset of rows using SQL-like conditions:
```yaml
tables:
  - name: "order"
    where: "status = 'SHIPPED'"
```

### Incremental Extraction (if supported by source)

You can extract only new or updated rows:
```yaml
tables:
  - name: "order"
    incremental:
      column: "timestamp"
```

## Running the Extraction

Once your config is ready:

1. Click Extract File (top-right button in the GUI).
2. Starlake connects to the database using your config.
3. Extracted files are saved into:
```yaml
datasets/incoming/<schema>/
```

## What You Can Do After Extracting

You can now:

1. Load extracted data into your warehouse
2. Apply transformations
3. Add expectations
4. Schedule extractions to run automatically

The Extract feature is fully integrated into the Starlake pipeline lifecycle.