---
sidebar_position: 200
title: ingest
description: "Ingest data files into a target domain and schema, with support for multiple paths, scheduling, and custom substitutions."
keywords:
  - starlake ingest
  - data ingestion
  - file loading
  - scheduled ingestion
---


## Synopsis

**starlake ingest \<domain\> \<schema\> [\<paths\>] [\<options\>] [--scheduledDate \<value\>]**

## Description

Generic data ingestion command that loads a single file into a table using an existing schema definition.

## Parameters

Parameter|Cardinality|Description
---|---|---
domain|*Optional*|Domain name
schema|*Optional*|Schema name
paths|*Optional*|list of comma separated paths
options|*Optional*|arguments to be used as substitutions
--scheduledDate `<value>`|*Optional*|Scheduled date for the job, in format yyyy-MM-dd'T'HH:mm:ss.SSSZ