---
sidebar_position: 150
title: extract-schema
description: "Extract database table schemas and output them as YAML definition files with optional snake_case naming and parallelism control."
keywords:
  - starlake extract-schema
  - schema extraction
  - YAML schema output
  - database reverse engineering
---


## Synopsis

**starlake extract-schema [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--config `<value>`|*Optional*|Database tables & connection info
--all `<value>`|*Optional*|Should we extract all schemas and tables to external folder ?
--tables `<value>`|*Optional*|Database tables info
--connectionRef `<value>`|*Optional*|Database connection to use
--outputDir `<value>`|*Optional*|Where to output YML files
--external `<value>`|*Optional*|Should we output YML files in the external folder
--parallelism `<value>`|*Optional*|parallelism level of the extraction process. By default equals to the available cores
--snakecase `<value>`|*Optional*|Apply snake case when name sanitization is done