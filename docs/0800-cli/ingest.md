---
sidebar_position: 250
title: ingest
description: "Ingest data files into a target domain and schema, with support for multiple paths, scheduling, and custom substitutions."
keywords: [starlake ingest, data ingestion, file loading, ETL]
---


## Synopsis

**starlake ingest [options]**

## Description
Generic data ingestion command that loads a single file into a table using an existing schema definition.

## Parameters

Parameter|Cardinality|Description
---|---|---
`<domain>`|*Optional, Positional*|Domain name
`<schema>`|*Optional, Positional*|Schema name
`<paths>`|*Optional, Positional*|list of comma separated paths
`<options>`|*Optional, Positional*|arguments to be used as substitutions
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--scheduledDate `<value>`|*Optional*|Scheduled date for the job, in format yyyy-MM-dd'T'HH:mm:ss.SSSZ