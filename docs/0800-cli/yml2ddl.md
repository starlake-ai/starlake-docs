---
sidebar_position: 480
title: yml2ddl
description: "Generate DDL statements from Starflow YAML schemas for your target data warehouse, with optional JDBC apply support."
keywords: [starlake yml2ddl, DDL generation, schema to SQL, data warehouse, database migration]
---


## Synopsis

**starlake yml2ddl [options]**

## Description
Generate SQL DDL statements (CREATE TABLE, etc.) from Starflow YAML table definitions.

## Parameters

Parameter|Cardinality|Description
---|---|---
--apply|*Optional*|Does the file contain a header (For CSV files only)
--catalog `<value>`|*Optional*|Database Catalog if any
--connection `<value>`|*Optional*|JDBC connection name with at least read write on database schema
--datawarehouse `<value>`|*Required*|target datawarehouse name (ddl mapping key in types.yml
--domain `<value>`|*Optional*|Domain to create DDL for. All by default
--output `<value>`|*Optional*|Where to output the generated files. ./$datawarehouse/ by default
--parallelism `<value>`|*Optional*|parallelism level. By default equals to the available cores: 16
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--schemas `<value>`|*Optional*|List of schemas to generate DDL for. All by default