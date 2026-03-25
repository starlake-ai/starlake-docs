---
sidebar_position: 1
title: Ingestion & Loading
description: Skills for ingesting and loading data into your data warehouse
---

# Ingestion & Loading

9 skills covering every aspect of data ingestion — from auto-inferring schemas to loading into BigQuery, Snowflake, Elasticsearch, and Kafka.

## Skills

### autoload

**Auto-infer schemas and load data** in a single step. Scans incoming files, infers column types, and creates load configurations automatically.

```
You: /autoload Infer schema from my CSV files in the incoming/customers/ directory
```

**Key features:**
- Automatic type inference from file samples
- Support for CSV, JSON, XML, and Parquet
- Generates both domain and table YAML configurations

---

### load

**Load data from the pending area** into your target warehouse. The primary ingestion skill with comprehensive write strategy support.

```
You: /load Configure loading JSON files into BigQuery with UPSERT_BY_KEY strategy
```

**Write strategies:**
| Strategy | Description |
|---|---|
| `APPEND` | Add new records without deduplication |
| `OVERWRITE` | Replace all existing data |
| `UPSERT_BY_KEY` | Update by primary key, insert new |
| `UPSERT_BY_KEY_AND_TIMESTAMP` | Update by key + timestamp for SCD |
| `SCD2` | Slowly changing dimension type 2 |
| `DELETE_THEN_INSERT` | Delete matching records, then insert |

**Supported sinks:** BigQuery, Snowflake, DuckDB, PostgreSQL, Redshift, Databricks, Elasticsearch, Kafka

---

### cnxload

**Load files directly into JDBC tables.** Bypasses the standard staging pipeline for direct file-to-database loading.

```
You: /cnxload Load a CSV file directly into my PostgreSQL customers table
```

---

### esload

**Load data into Elasticsearch indices.** Configure index mappings, document IDs, and bulk loading parameters.

```
You: /esload Configure loading product data into an Elasticsearch index
```

---

### index

**Alternative Elasticsearch loading skill.** Similar to `esload` with additional indexing options.

---

### ingest

**Generic data ingestion skill.** Covers the overall ingestion pipeline from landing to accepted/rejected areas.

```
You: /ingest Walk me through the full ingestion pipeline for XML files
```

---

### kafkaload

**Load data to/from Apache Kafka topics.** Configure producers, consumers, serialization, and topic management.

```
You: /kafkaload Set up Kafka ingestion for real-time event data
```

**Capabilities:**
- Topic-to-table loading
- Table-to-topic offloading
- Avro/JSON serialization
- Consumer group management

---

### preload

**Check the landing area** for incoming files before processing. Validates file presence, naming conventions, and readiness.

```
You: /preload Configure landing area checks for my daily CSV deliveries
```

---

### stage

**Move files from landing to pending area.** Handles file organization, renaming, and preparation for the load step.

```
You: /stage Set up staging rules for files arriving in GCS
```

## Common Configuration Example

A typical ingestion domain configuration:

```yaml
# metadata/load/customers/_config.sl.yml
load:
  metadata:
    mode: FILE
    format: DSV
    withHeader: true
    separator: ","
    encoding: UTF-8
    multiline: false
    writeStrategy:
      type: UPSERT_BY_KEY_AND_TIMESTAMP
      key: [customer_id]
      timestamp: updated_at
    sink:
      connectionRef: my-bigquery
      partition:
        - ingestion_date
```

```yaml
# metadata/load/customers/customers.sl.yml
table:
  name: customers
  pattern: "customers-.*.csv"
  attributes:
    - name: customer_id
      type: long
      required: true
      privacy: NONE
    - name: email
      type: string
      required: true
      privacy: SHA256
    - name: name
      type: string
    - name: created_at
      type: timestamp
    - name: updated_at
      type: timestamp
```
