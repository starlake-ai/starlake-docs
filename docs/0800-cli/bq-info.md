---
sidebar_position: 50
title: bq-info
description: "Retrieve metadata and information about BigQuery tables and datasets, with options to persist results or filter by table."
keywords: [starlake bq-info, BigQuery, table metadata, dataset info]
---


## Synopsis

**starlake bq-info [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--accessToken `<value>`|*Optional*|Access token to use for authentication
--connection `<value>`|*Optional*|Connection to use
--database `<value>`|*Optional*|database / project id
--external|*Optional*|Include external datasets defined in _config.sl.yml instead of using other parameters of this command ? Defaults to false
--persist `<value>`|*Optional*|Persist results ?
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--tables `<value>`|*Optional*|List of datasetName.tableName1,datasetName.tableName2 ...
--write `<value>`|*Optional*|One of Set(OVERWRITE, APPEND)