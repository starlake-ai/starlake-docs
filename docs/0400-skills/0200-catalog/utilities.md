---
sidebar_position: 10
title: Utilities
description: Utility skills for format conversion, comparison, and documentation
---

# Utilities

7 skills for format conversion, data comparison, change impact, documentation generation, and testing.

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

### impact

**Change impact before running.** Report which load tables and transforms a change touches (`BREAKING`, `NON_BREAKING`, `ADDED`, `METADATA`) and which downstream tasks it impacts through column-level lineage, offline and without executing anything. See [Check change impact](../../0300-guides/600-deploy/200-change-impact.mdx).

```
You: /impact What does my branch break compared to main?
```

**Use cases:**
- Pull request review: comment the Markdown report on the PR
- CI gate with `--fail-on breaking`
- Checking a schema or SQL refactoring before deploying

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
