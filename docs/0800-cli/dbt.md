---
sidebar_position: 120
title: dbt
description: "Convert a dbt project into native Starlake YAML and SQL, once, from its manifest.json: models, seeds, sources, tests and docs."
keywords: [starlake dbt import, dbt migration, migrate from dbt, dbt manifest]
---


## Synopsis

**starlake dbt import [options]**

## Description
Convert a dbt project into the current Starlake project, from target/manifest.json (run `dbt deps && dbt parse` first).
Every macro is expanded; incremental models keep their two versions as `{% if sl_incremental %}`.
Writes dbt-import-report.md at the project root. Exit codes: 0 imported, 1 usage error, unreadable manifest, or existing files without --force.
````shell
starlake dbt import --manifest ../shop/target/manifest.json --profiles ~/.dbt/profiles.yml --target dev
````


## Parameters

Parameter|Cardinality|Description
---|---|---
`<action>`|*Required, Positional*|import
--connection `<value>`|*Optional*|existing Starlake connection the imported objects run on
--force|*Optional*|overwrite the files the import writes; nothing is deleted
--introspect|*Optional*|answer the macros that read the warehouse (run_query, statement, adapter.get_columns_in_relation...) on the import's connection; read-only statements only
--introspect-max-rows `<value>`|*Optional*|with --introspect, the most rows a query may return before its model is skipped (default 10000)
--manifest `<value>`|*Required*|dbt's target/manifest.json
--profiles `<value>`|*Optional*|dbt profiles.yml: the target renders target.*, and a DuckDB target becomes a connection
--target `<value>`|*Optional*|dbt target: target.name, and the output of --profiles (default: the profile's target, else dev)
--vars `<value>`|*Optional*|dbt --vars, a YAML or JSON map, over the vars of dbt_project.yml