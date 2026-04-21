---
sidebar_position: 155
title: extract-rest-schema
description: "Extract schemas from REST API endpoints by fetching sample data and inferring the structure."
keywords: [starlake extract-rest-schema, REST API, schema extraction, API schema]
---


## Synopsis

**starlake extract-rest-schema [options]**

## Description

Extract schemas from REST API endpoints by fetching sample responses and inferring the data structure. Generates Starlake YAML configuration files (domain + table definitions) that can be used for subsequent data extraction and ingestion.

See [REST API Extraction Guide](/guides/extract/extract-rest-api).

## Examples

```bash
starlake extract-rest-schema --config my-rest-api
starlake extract-rest-schema --config my-rest-api --outputDir /tmp/schemas
```

## Parameters

Parameter|Cardinality|Description
---|---|---
--config `<value>`|*Required*|REST API extraction config file (in metadata/extract/)
--outputDir `<value>`|*Optional*|Where to output YAML files
--connectionRef `<value>`|*Optional*|Connection reference name
--reportFormat `<value>`|*Optional*|Report format: console, json, html