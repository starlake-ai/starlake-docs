---
sidebar_position: 330
title: run
description: "Execute the project's tasks in dependency order, in parallel, inside this JVM."
keywords: [starlake run]
---


## Synopsis

**starlake run [options]**

## Description
Execute the project's tasks in dependency order, in parallel, inside this JVM. The graph is built from transform lineage, so a load table is executed only when some transform reads it: tables no transform references are never ingested by this command.

## Parameters

Parameter|Cardinality|Description
---|---|---
--parallelism `<value>`|*Optional*|Max concurrently executing tasks. Defaults to the maxParTask setting (SL_MAX_PAR_TASK). Raising it runs tasks concurrently through code paths that are not concurrency-safe in all engines, so treat it as an explicit opt-in.
--fail-fast `<value>`|*Optional*|Abort the whole run on first failure instead of only the failed branch
--options `k1=v1,k2=v2...`|*Optional*|Variables passed to the templating path
--reportFormat `<value>`|*Optional*|Report format: console, json, html