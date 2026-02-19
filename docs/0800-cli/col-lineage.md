---
sidebar_position: 60
title: col-lineage
description: "Build and export column-level data lineage for a specific task as JSON, helping trace data flow across transformations."
keywords:
  - starlake col-lineage
  - column lineage
  - data lineage
  - data traceability
---


## Synopsis

**starlake col-lineage [options]**

## Description
Build lineage

## Parameters

Parameter|Cardinality|Description
---|---|---
--output `<value>`|*Optional*|Where to save the generated JSON file ? Output to the console by default
--task `<value>`|*Required*|task name to buidl lineage for
--accessToken `<value>`|*Optional*|Access token to use for authentication