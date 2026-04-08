---
sidebar_position: 4
title: Schema Management
description: Skills for project bootstrapping, schema inference, and format conversion
---

# Schema Management

6 skills for creating projects, inferring schemas, and converting between formats.

## Skills

### bootstrap

**Create a new Starlake project from template.** Generates the complete project structure with configuration files.

```
You: /bootstrap Create a new project targeting BigQuery with Airflow orchestration
```

**Generated structure:**
```
my-project/
├── metadata/
│   ├── application.sl.yml
│   ├── env.sl.yml
│   ├── types/default.sl.yml
│   └── load/sample/
├── datasets/
└── starlake.sh
```

---

### infer-schema

**Infer schema from data files.** Analyzes file samples to automatically detect column types and generate table YAML.

```
You: /infer-schema Infer the schema from my transactions.csv file
```

---

### xls2yml

**Convert Excel spreadsheets to YAML configurations.** Transform structured Excel documents into Starlake domain and table definitions.

```
You: /xls2yml Convert my data dictionary Excel file into Starlake YAML configs
```

---

### xls2ymljob

**Convert Excel to YAML for transformation jobs.** Similar to `xls2yml` but focused on generating transform task definitions.

```
You: /xls2ymljob Convert my transformation specs spreadsheet to task YAML
```

---

### yml2ddl

**Generate SQL DDL from YAML configurations.** Convert Starlake table definitions into CREATE TABLE statements.

```
You: /yml2ddl Generate BigQuery DDL for all tables in the customers domain
```

---

### yml2xls

**Export YAML configurations to Excel.** Generate documentation-friendly Excel spreadsheets from your Starlake configs.

```
You: /yml2xls Export my entire project schema to an Excel data dictionary
```
