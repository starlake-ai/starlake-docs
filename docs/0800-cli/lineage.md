---
sidebar_position: 280
title: lineage
description: "Generate task dependency graphs as DOT or JSON to visualize data lineage across your Starflow project."
keywords: [starlake lineage, data lineage, dependency graph, task dependencies, DAG visualization]
---


## Synopsis

**starlake lineage [options]**

## Description
Generate a task dependency graph showing how transformation tasks relate to each other.

Generate Task dependencies graph

## Parameters

Parameter|Cardinality|Description
---|---|---
--all|*Optional*|Include all tasks  in the dot file ? None by default
--json|*Optional*|Should we generate JSON files ?
--objects `<value>`|*Optional*|comma separated list of objects to display: task, table, view, unknown
--output `<value>`|*Optional*|Where to save the generated dot file ? Output to the console by default
--print|*Optional*|Print dependencies as text
--reload|*Optional*|Should we reload the domains first ?
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--task `<value>`|*Optional*|Compute dependencies of these tasks only. If not specified, compute all jobs.
--verbose|*Optional*|Add extra table properties
--viz|*Optional*|Should we generate a dot file ?