---
sidebar_position: 290
title: load
description: "Ingest raw files into your data warehouse by watching specified domains and tables with schema validation and options."
keywords: [starlake load, data ingestion, file loading, schema validation, ETL]
---


## Synopsis

**starlake load [options]**

## Description
Load data files from the pending directory into the data warehouse using schema definitions. See [Load Tutorial](/starflow/guides/load/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---
--accessToken `<value>`|*Optional*|Access token to use for authentication
--domains `domain1,domain2...`|*Optional*|Domains to watch
--files `<value>`|*Optional*|load this file only
--include `domain1,domain2...`|*Optional*|Deprecated: Domains to watch
--inPlace|*Optional*|Ingest files from their current location without moving them. Requires --files
--options `k1=v1,k2=v2...`|*Optional*|Watch arguments to be used as substitutions
--primaryKeys `<value>`|*Optional*|primary keys to set on the table schema
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--scheduledDate `<value>`|*Optional*|Scheduled date for the job, in format yyyy-MM-dd'T'HH:mm:ss.SSSZ
--schemas `schema1,schema2,schema3...`|*Optional*|Deprecated: Schemas to watch
--tables `table1,table2,table3 ...`|*Optional*|Tables to watch
--test|*Optional*|Should we run this load as a test ? Default value is false