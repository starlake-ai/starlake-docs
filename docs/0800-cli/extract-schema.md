---
sidebar_position: 180
title: extract-schema
description: "Extract database table schemas and output them as YAML definition files with optional snake_case naming and parallelism control."
keywords: [starlake extract-schema, schema extraction, database schema, YAML generation]
---


## Synopsis

**starlake extract-schema [options]**

## Description
Extract table schemas from a JDBC database and generate Starflow YAML configuration files. Use this to reverse-engineer existing database tables into domain definitions with optional snake_case naming. See [Extract Tutorial](/starflow/guides/extract/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---
--all|*Optional*|Should we extract all schemas and tables to external folder ?
--config `<value>`|*Optional*|Database tables & connection info
--connectionRef `<value>`|*Optional*|Database connection to use
--external|*Optional*|Should we output YML files in the external folder
--outputDir `<value>`|*Optional*|Where to output YML files
--parallelism `<value>`|*Optional*|parallelism level of the extraction process. By default equals to the available cores
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--snakecase|*Optional*|Apply snake case when name sanitization is done
--tables `<value>`|*Optional*|Database tables info