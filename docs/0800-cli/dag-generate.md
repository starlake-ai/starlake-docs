---
sidebar_position: 110
title: dag-generate
description: "Generate DAG files for tasks and domains with optional tag filtering and role definitions for workflow orchestration tools."
keywords: [starlake dag-generate, DAG generation, Airflow, workflow orchestration]
---


## Synopsis

**starlake dag-generate [options]**

## Description
Generate Airflow or Dagster DAG files from Starflow task and domain definitions. The command analyzes SQL dependencies to produce correctly ordered workflow graphs, with optional tag filtering. See [Orchestration Guide](/starflow/guides/orchestrate/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---
--clean|*Optional*|Clean Resulting DAG file output first ?
--domains|*Optional*|Whether to generate DAG file(s) for domains or not
--outputDir `<value>`|*Optional*|Path for saving the resulting DAG file(s).
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--tags `<value>`|*Optional*|Generate for these tags only
--tasks|*Optional*|Whether to generate DAG file(s) for tasks or not
--withRoles|*Optional*|Generate role definitions