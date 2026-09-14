---
sidebar_position: 330
title: run
description: "Execute the project's tasks in dependency order, in parallel, inside this JVM."
keywords: [starlake run]
---


## Synopsis

**starlake run [options]**

## Description
Execute the project's tasks in dependency order, in parallel, inside this JVM. The graph is built from transform lineage, so a load table is executed only when some transform reads it: tables no transform references are never ingested by this command. When a transform and a declared load table share a domain.table name, the two collapse to a single node and the transform is what runs, never the load.

Selector syntax, shared by --select and --exclude:

    domain.table    exactly that task
    domain.*        every task in the domain
    tag:VALUE       every task carrying the tag
    +expr           the matched tasks and all their transitive upstreams
    expr+           the matched tasks and all their transitive downstreams
    +expr+          both directions

Matching is case-insensitive. A run executes the selected set and nothing else: unselected upstreams are not run implicitly, so a task whose input is missing fails normally. A selection that matches no task exits with code 3.

## Parameters

Parameter|Cardinality|Description
---|---|---
--parallelism `<value>`|*Optional*|Max concurrently executing tasks. Defaults to the maxParTask setting (SL_MAX_PAR_TASK). Raising it runs tasks concurrently through code paths that are not concurrency-safe in all engines, so treat it as an explicit opt-in.
--fail-fast `<value>`|*Optional*|Abort the whole run on first failure instead of only the failed branch
--select `expr1,expr2...`|*Optional, Unbounded*|Selector expressions, unioned. Repeatable, and each value may itself be a comma-separated list. Omit to select the whole project.
--exclude `expr1,expr2...`|*Optional, Unbounded*|Selector expressions subtracted after --select. Exclusion wins.
--dry-run `<value>`|*Optional*|Resolve and print the execution plan, execute nothing
--options `k1=v1,k2=v2...`|*Optional*|Variables passed to the templating path
--reportFormat `<value>`|*Optional*|Report format: console, json, html