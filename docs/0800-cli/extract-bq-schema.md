---
sidebar_position: 130
title: extract-bq-schema
description: "Extract BigQuery table schemas and dataset metadata with options to filter tables, set connections, and persist results."
keywords:
  - starlake extract-bq-schema
  - BigQuery schema extraction
  - dataset metadata
  - schema export
---


## Synopsis

**starlake extract-bq-schema [options]**

## Description

Extract table schemas from BigQuery datasets and generate Starlake YAML configuration files. Use this to reverse-engineer existing BigQuery tables into Starlake domain definitions.

## Parameters

Parameter|Cardinality|Description
---|---|---
--write `<value>`|*Optional*|One of Set(OVERWRITE, APPEND)
--connection `<value>`|*Optional*|Connection to use
--database `<value>`|*Optional*|database / project id
--external `<value>`|*Optional*|Include external datasets defined in _config.sl.yml instead of using other parameters of this command ? Defaults to false
--tables `<value>`|*Optional*|List of datasetName.tableName1,datasetName.tableName2 ...
--accessToken `<value>`|*Optional*|Access token to use for authentication
--persist `<value>`|*Optional*|Persist results ?