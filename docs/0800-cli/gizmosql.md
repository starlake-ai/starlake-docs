---
sidebar_position: 170
title: gizmosql
description: "Run SQL queries on any database using JDBC with Spark, supporting session parameters and variable substitutions."
keywords: [starlake gizmosql, SQL runner, JDBC query, database query]
---


## Synopsis

**starlake gizmosql [options]**

## Description
Manage GizmoSQL processes.
Actions: start, stop, list, stop-all

## Parameters

Parameter|Cardinality|Description
---|---|---
--action `<value>`|*Required*|Action to perform: start, stop, list, stop-all
--connection `<value>`|*Optional*|Connection name (required for start)
--process-name `<value>`|*Optional*|Process name (required for stop)
--port `<value>`|*Optional*|Port for the GizmoSQL process (optional, for start)
--reportFormat `<value>`|*Optional*|Report format: console, json, html