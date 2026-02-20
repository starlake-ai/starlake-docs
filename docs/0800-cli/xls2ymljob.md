---
sidebar_position: 390
title: xls2ymljob
description: "Convert Excel files describing transform job definitions into Starlake YAML task configuration files. Ideal for business analysts who define transformations in spreadsheets."
keywords: [starlake xls2ymljob, Excel to YAML, job generation, task configuration, transform definition]
---


## Synopsis

**starlake xls2ymljob [options]**

## Description

Generate Starlake YAML transform/job configuration files from Excel spreadsheets. This is a convenience alias for `xls2yml --job=true`.

Business analysts define transform tasks in Excel (target tables, write strategies, partitioning, etc.), and data engineers generate the corresponding Starlake YAML task files automatically. The SQL logic is written separately — this command only generates the YAML metadata.

See also: [`xls2yml`](/cli/xls2yml) (domain/schema variant), [`yml2xls`](/cli/yml2xls) (reverse operation).

## Parameters

Parameter|Cardinality|Description
---|---|---
--files `<value>`|*Required*|List of Excel files (.xlsx or .xls) describing job/task definitions. Can also be a directory (recursively finds all .xlsx files).
--iamPolicyTagsFile `<value>`|*Optional*|Path to an Excel file for generating IAM PolicyTags YAML.
--outputDir `<value>`|*Optional*|Path for saving the resulting YAML files. Defaults to the Starlake transform path.
--policyFile `<value>`|*Optional*|Excel file for centralizing ACL & RLS definitions.

## Excel Workbook Structure

The Excel file must contain a `schemas` sheet defining the transform tasks.

### Sheet: `schemas`

Each row defines one transform task. Maps to a `{job_name}.sl.yml` file.

Column|Required|Description
---|---|---
`_job`|Yes|Job/task name
`_domain`|Yes|Target domain (output database schema/dataset)
`_name`|Yes|Target table name
`_write`|No|Write strategy: `OVERWRITE`, `APPEND`, `OVERWRITE_BY_PARTITION`, `UPSERT_BY_KEY`, `UPSERT_BY_KEY_AND_TIMESTAMP`, `SCD2`, `DELETE_THEN_INSERT`
`_partition`|No|Partition column
`_description`|No|Job/task description
`_database`|No|Target database name
`_clustering`|No|Comma-separated clustering columns
`_tags`|No|Comma-separated tags
`_presql`|No|Pre-SQL statements (separate multiple with `###`)
`_postsql`|No|Post-SQL statements (separate multiple with `###`)
`_sink`|No|Sink type: `BQ`, `FS`, `JDBC`, `ES`, `KAFKA`
`_sinkConnectionRef`|No|Connection name for the sink
`_connectionRef`|No|Run engine connection name/type
`_format`|No|Output format for FS sink (e.g., `csv`, `parquet`)
`_extension`|No|File extension for FS sink
`_coalesce`|No|Coalesce output into a single file (true/false, FS sink only)
`_options`|No|Sink options as key=value pairs (e.g., `opt1=val1,opt2=val2`)
`_dagRef`|No|DAG reference for orchestration
`_freshness`|No|Freshness rules as key=value pairs
`_policy`|No|Access policy names (comma-separated)

### Attribute Sheets (optional)

For each task, you can optionally create a sheet matching the `_name` value to define output attribute descriptions.

Column|Required|Description
---|---|---
`_name`|Yes|Attribute/column name
`_description`|No|Attribute description

## Example

Given an Excel file `analytics_jobs.xlsx` with a `schemas` sheet:

| _job | _domain | _name | _write | _dagRef |
|------|---------|-------|--------|---------|
| daily_revenue | analytics | revenue_by_product | OVERWRITE | daily_dag |
| customer_ltv | analytics | customer_lifetime_value | SCD2 | weekly_dag |

```bash
starlake xls2ymljob --files analytics_jobs.xlsx
```

This generates:
```
metadata/transform/analytics/
├── daily_revenue.sl.yml            # Task definition for revenue_by_product
└── customer_ltv.sl.yml             # Task definition for customer_lifetime_value
```

Each generated `.sl.yml` contains the task metadata (write strategy, partitioning, etc.). The actual SQL query must be provided separately as a `.sql` file alongside the YAML.
