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

**starlake ingest [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--domain `<value>`|*Optional*|Domain name
--schema `<value>`|*Optional*|Schema name
--paths `<value>`|*Optional*|list of comma separated paths
--options `<value>`|*Optional*|arguments to be used as substitutions
--scheduledDate `<value>`|*Optional*|Scheduled date for the job, in format yyyy-MM-dd'T'HH:mm:ss.SSSZ