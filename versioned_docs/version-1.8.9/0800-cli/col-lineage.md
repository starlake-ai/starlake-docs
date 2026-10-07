---
sidebar_position: 70
title: col-lineage
description: "Build and export column-level data lineage for a specific task as JSON, helping trace data flow across transformations."
keywords: [starlake col-lineage, column lineage, data lineage, data tracing]
---


## Synopsis

**starlake col-lineage [options]**

## Description
Generate column-level lineage showing which source columns feed into each target column across transformations. Use this command to trace data flow and understand the provenance of computed fields.

Build lineage

## Parameters

Parameter|Cardinality|Description
---|---|---
--output `<value>`|*Optional*|Where to save the generated JSON file ? Output to the console by default
--task `<value>`|*Required*|task name to buidl lineage for
--accessToken `<value>`|*Optional*|Access token to use for authentication
--reportFormat `<value>`|*Optional*|Report format: console, json, html