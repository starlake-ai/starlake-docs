---
sidebar_position: 130
title: extract-bq-schema
description: "Extract BigQuery table schemas and dataset metadata with options to filter tables, set connections, and persist results."
keywords: [starlake extract-bq-schema, BigQuery schema, schema extraction, metadata]
---


## Synopsis

**starlake extract-bq-schema [options]**

## Description


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
--table-types `<value>`|*Optional*|Types of the objects to extract, among EXTERNAL, MATERIALIZED_VIEW, SNAPSHOT, TABLE, VIEW. Defaults to TABLE. The types of a standard SQL VIEW are read with a dry run query, which needs bigquery.jobs.create, or from its stored schema, which may be stale
--reportFormat `<value>`|*Optional*|Report format: console, json, html