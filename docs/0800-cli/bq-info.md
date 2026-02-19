---
sidebar_position: 40
title: bq-info
description: "Retrieve metadata and information about BigQuery tables and datasets, with options to persist results or filter by table."
keywords:
  - starlake bq-info
  - BigQuery metadata
  - dataset information
  - table info
---


## Synopsis

**starlake bq-info [options]**

## Description

Retrieve table metadata and statistics from BigQuery, including row counts, schema information, and storage details. Use this command to inspect dataset properties or audit table configurations.

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