---
sidebar_position: 100
title: dag-generate
description: "Generate DAG files for tasks and domains with optional tag filtering and role definitions for workflow orchestration tools."
keywords:
  - starlake dag-generate
  - DAG generation
  - Airflow DAG
  - workflow orchestration
---


## Synopsis

**starlake dag-generate [options]**

## Description

Generate Airflow or Dagster DAG files from Starlake task and domain definitions. The command analyzes SQL dependencies to produce correctly ordered workflow graphs, with optional tag filtering. See [Orchestration Guide](/guides/orchestrate/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---
--outputDir `<value>`|*Optional*|Path for saving the resulting DAG file(s).
--clean `<value>`|*Optional*|Clean Resulting DAG file output first ?
--tags `<value>`|*Optional*|Generate for these tags only
--tasks `<value>`|*Optional*|Whether to generate DAG file(s) for tasks or not
--domains `<value>`|*Optional*|Whether to generate DAG file(s) for domains or not
--withRoles `<value>`|*Optional*|Generate role definitions