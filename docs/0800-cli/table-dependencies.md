---
sidebar_position: 400
title: table-dependencies
description: "Generate table dependency diagrams from domain and schema YAML files, as DOT or JSON."
keywords: [starlake table-dependencies, schema dependencies, DOT, entity relationship, data modeling]
---


## Synopsis

**starlake table-dependencies [options]**

## Description
Generate a table dependency graph showing foreign key and lineage relationships between tables.

Generate DOT or JSON files from Domain / Schema YAML files

## Parameters

Parameter|Cardinality|Description
---|---|---
--output `<value>`|*Optional*|Where to save the generated dot file ? Output to the console by default
--all-attrs `<value>`|*Optional*|Should we include all attributes in the dot file or only the primary and foreign keys ? true by default
--reload `<value>`|*Optional*|Should we reload the domains first ?
--related `<value>`|*Optional*|Should we include only entities with relations to others ? false by default
--tables `<value>`|*Optional*|Which tables should we include in the dot file ?
--all `<value>`|*Optional*|Include all tables in the dot file ? All by default
--json `<value>`|*Optional*|JSON output ?
--reportFormat `<value>`|*Optional*|Report format: console, json, html