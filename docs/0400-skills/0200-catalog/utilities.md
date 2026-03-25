---
sidebar_position: 10
title: Utilities
description: Utility skills for format conversion, comparison, and documentation
---

# Utilities

5 skills for format conversion, data comparison, documentation generation, and testing.

## Skills

### bq-info

**BigQuery metadata and information.** Query BigQuery metadata including dataset info, table details, and storage statistics.

```
You: /bq-info Show me the storage size and row counts for all tables in the analytics dataset
```

---

### compare

**Data comparison utilities.** Compare datasets across environments, time periods, or pipeline versions.

```
You: /compare Compare the customers table between dev and prod environments
```

**Use cases:**
- Environment drift detection
- Migration validation
- Regression testing after pipeline changes
- Data reconciliation

---

### parquet2csv

**Convert Parquet files to CSV.** Transform columnar Parquet files into human-readable CSV format.

```
You: /parquet2csv Convert my output Parquet files to CSV for review
```

---

### site

**Static site generation.** Generate documentation websites from your Starlake project configuration.

```
You: /site Generate a documentation site for my project
```

**Generated documentation includes:**
- Domain and table catalog
- Schema documentation with column descriptions
- Lineage diagrams
- Configuration reference

---

### test

**Testing utilities.** Configure and run tests for your Starlake pipelines.

```
You: /test Set up integration tests for the customers load pipeline
```

---

### summarize

**Project summarization.** Generate a high-level summary of your Starlake project including domains, tables, transforms, and statistics.

```
You: /summarize Give me an overview of the entire project
```
