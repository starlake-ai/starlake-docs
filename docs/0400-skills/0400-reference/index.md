---
id: skills-reference
sidebar_position: 1
title: Reference
description: Technical reference for project structure, schemas, and CLI commands
---

# Reference

Technical reference documentation for Starlake Skills and the Starlake platform.

## Quick Links

| Resource | Description |
|---|---|
| [Project Structure](./project-structure.md) | Standard Starlake project layout |
| [Schema Reference](./schema-reference.md) | YAML configuration schema documentation |
| [Starlake CLI Docs](https://docs.starlake.ai) | Official Starlake documentation |
| [JSON Schema](https://www.schemastore.org/starlake.json) | Machine-readable config schema |
| [GitHub Repository](https://github.com/starlake-ai/starlake-skills) | Source code and issues |
| [Starlake Examples](https://github.com/starlake-ai/starlake-examples) | Sample projects |

## All 48 Skills

| Skill | Category | Description |
|---|---|---|
| `acl-dependencies` | Lineage | Access control lineage |
| `autoload` | Ingestion | Auto-infer schemas and load data |
| `bootstrap` | Schema | New project from template |
| `bq-info` | Utilities | BigQuery metadata and info |
| `cnxload` | Ingestion | Load files into JDBC tables |
| `col-lineage` | Lineage | Column-level lineage tracking |
| `compare` | Utilities | Data comparison |
| `config` | Reference | Configuration reference |
| `connection` | Configure | Database connection management |
| `console` | Operations | Console access |
| `dag-deploy` | Orchestration | Deploy DAGs to Airflow/Dagster |
| `dag-generate` | Orchestration | Generate DAGs from config |
| `esload` | Ingestion | Elasticsearch loading |
| `expectations` | Quality | Data quality validations |
| `extract` | Extraction | Schema + data extraction |
| `extract-bq-schema` | Extraction | BigQuery schema extraction |
| `extract-data` | Extraction | Data export to files |
| `extract-schema` | Extraction | JDBC schema extraction |
| `extract-script` | Extraction | Extraction script generation |
| `freshness` | Operations | Data freshness monitoring |
| `gizmosql` | Operations | DuckLake SQL endpoint management |
| `iam-policies` | Security | IAM policy configuration |
| `index` | Ingestion | Elasticsearch indexing |
| `infer-schema` | Schema | Schema inference from files |
| `ingest` | Ingestion | Generic data ingestion |
| `job` | Transform | Run transformation jobs |
| `kafkaload` | Ingestion | Kafka load/offload |
| `lineage` | Lineage | Data lineage visualization |
| `load` | Ingestion | Load from pending area |
| `metrics` | Operations | Pipeline metrics |
| `migrate` | Operations | Schema migration |
| `parquet2csv` | Utilities | Parquet to CSV conversion |
| `preload` | Ingestion | Landing area checks |
| `secure` | Security | RLS, CLS, privacy transforms |
| `serve` | Operations | Data serving config |
| `settings` | Operations | Application settings |
| `site` | Utilities | Documentation site generation |
| `stage` | Ingestion | File staging (landing → pending) |
| `starlake-skills` | Meta | About this plugin |
| `summarize` | Utilities | Project summarization |
| `table-dependencies` | Lineage | Table dependency analysis |
| `test` | Utilities | Pipeline testing |
| `transform` | Transform | SQL/Python transformations |
| `validate` | Operations | Project validation |
| `xls2yml` | Schema | Excel to YAML conversion |
| `xls2ymljob` | Schema | Excel to YAML (jobs) |
| `yml2ddl` | Schema | YAML to SQL DDL |
| `yml2xls` | Schema | YAML to Excel export |
