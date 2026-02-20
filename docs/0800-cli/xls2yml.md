---
sidebar_position: 380
title: xls2yml
description: "Convert Excel files describing domains, schemas and attributes into Starlake YAML configuration files. Ideal for business analysts who prefer spreadsheets over YAML editing."
keywords: [starlake xls2yml, Excel to YAML, schema generation, data modeling, IAM policy, domain definition]
---


## Synopsis

**starlake xls2yml [options]**

## Description

Generate Starlake YAML configuration files from Excel spreadsheets. This command is designed for teams where **business analysts** define data schemas in Excel (a familiar format), and data engineers generate the corresponding Starlake YAML files automatically.

The Excel workbook must follow a specific structure with predefined sheets and columns. Starlake reads the workbook and produces:
- A `_config.sl.yml` file per domain
- A `{table_name}.sl.yml` file per schema/table
- Optionally, IAM policy tags and ACL/RLS policies

See also: [`yml2xls`](/cli/yml2xls) (reverse operation), [`xls2ymljob`](/cli/xls2ymljob) (job/transform variant).

## Parameters

Parameter|Cardinality|Description
---|---|---
--files `<value>`|*Required*|List of Excel files (.xlsx or .xls) describing domains & schemas. Can also be a directory (recursively finds all .xlsx files).
--iamPolicyTagsFile `<value>`|*Optional*|Path to an Excel file for generating IAM PolicyTags YAML.
--outputDir `<value>`|*Optional*|Path for saving the resulting YAML files. Defaults to the Starlake domains path.
--policyFile `<value>`|*Optional*|Excel file for centralizing ACL & RLS definitions.

## Excel Workbook Structure

The Excel file must contain the following sheets:

### Sheet: `_domain`

Defines the domain (one row). Maps to `_config.sl.yml`.

Column|Required|Description
---|---|---
`_name`|Yes|Domain name (maps to a database schema/dataset)
`_path`|No|Directory path for incoming files
`_ack`|No|Acknowledgment file pattern
`_description`|No|Domain description
`_rename`|No|Rename the domain in the target warehouse
`_tags`|No|Comma-separated tags
`_dagRef`|No|DAG reference for orchestration
`_frequency`|No|Schedule/frequency (e.g., `daily`, cron expression)
`_freshness`|No|Freshness rules as key=value pairs (e.g., `warn=24h,error=48h`)

### Sheet: `_schemas`

Defines tables/schemas (one row per table). Each table listed here must have a corresponding attribute sheet.

Column|Required|Description
---|---|---
`_name`|Yes|Table/schema name (must match a sheet name in the workbook)
`_pattern`|Yes|Regex pattern for matching incoming files (e.g., `orders.*.csv`)
`_write`|No|Write strategy: `OVERWRITE`, `APPEND`, `ERROR_IF_EXISTS`, `SCD2`
`_format`|No|File format: `DSV`, `POSITION`, `XML`, `JSON`
`_header`|No|Whether the file has a header row (true/false)
`_delimiter`|No|Field separator character (e.g., `,`, `\|`, `;`)
`_delta_column`|No|Timestamp column for merge/upsert operations
`_merge_keys`|No|Comma-separated merge key columns
`_description`|No|Table description
`_encoding`|No|File encoding (default: UTF-8)
`_partitioning`|No|Comma-separated partition columns
`_clustering`|No|Comma-separated clustering columns
`_primary_key`|No|Comma-separated primary key columns
`_tags`|No|Comma-separated tags
`_rename`|No|Rename the table in the target warehouse
`_policy`|No|Access policy name (references the `_policies` sheet)
`_presql`|No|Pre-SQL statements (separate multiple with `###`)
`_postsql`|No|Post-SQL statements (separate multiple with `###`)
`_dagRef`|No|DAG reference
`_frequency`|No|Schedule/frequency
`_freshness`|No|Freshness rules as key=value pairs

### Sheet: `_policies` (optional)

Defines ACL and RLS policies.

Column|Required|Description
---|---|---
`_name`|Yes|Policy name
`_predicate`|No|WHERE clause for RLS (defaults to `TRUE`)
`_grants`|Yes|Comma-separated list of groups/users
`_description`|No|Policy description

### Sheet: `_iam_policy_tags` (optional)

Defines IAM policy tags for column-level access control.

Column|Required|Description
---|---|---
`_policyTag`|Yes|Policy tag identifier
`_members`|Yes|Comma-separated members
`_role`|Yes|IAM role

### Attribute Sheets (one per table)

For each table listed in `_schemas`, create a sheet with the **exact same name** as the `_name` value. Each row defines one attribute/column.

Column|Required|Description
---|---|---
`_name`|Yes|Attribute/column name. Use dot notation for nested structs (e.g., `address.street`).
`_type`|Yes|Data type: `string`, `integer`, `long`, `double`, `boolean`, `date`, `timestamp`, `struct`, etc.
`_rename`|No|Rename the column in the target warehouse
`_required`|No|Whether the field is required (true/false)
`_privacy`|No|Privacy transformation: `MD5`, `SHA1`, `INITIALS`, `HIDE`, or `SQL:expression`
`_metric`|No|Metric type: `CONTINUOUS`, `DISCRETE`
`_default`|No|Default value
`_script`|No|Transformation script (e.g., `current_date()`)
`_description`|No|Attribute description
`_position_start`|No|Start position for POSITION format (1-indexed)
`_position_end`|No|End position for POSITION format (1-indexed)
`_trim`|No|Trim strategy: `LEFT`, `RIGHT`, `BOTH`
`_ignore`|No|Ignore this attribute (true/false)
`_foreign_key`|No|Foreign key reference (e.g., `other_domain.other_table.column`)
`_tags`|No|Comma-separated tags

## Example

Given an Excel file `starbake.xlsx` with:
- A `_domain` sheet defining domain "starbake"
- A `_schemas` sheet listing tables "customers" and "orders"
- A `customers` sheet with columns (id, name, email, signup_date)
- An `orders` sheet with columns (order_id, customer_id, amount, order_date)

```bash
starlake xls2yml --files starbake.xlsx
```

This generates:
```
metadata/load/starbake/
├── _config.sl.yml        # Domain definition
├── customers.sl.yml      # customers table schema + attributes
└── orders.sl.yml         # orders table schema + attributes
```
