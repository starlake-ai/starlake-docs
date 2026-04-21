---
sidebar_position: 145
title: extract-rest-data
description: "Extract data from REST API endpoints into CSV files with support for pagination, authentication, and rate limiting."
keywords: [starlake extract-rest-data, REST API, data extraction, API data]
---


## Synopsis

**starlake extract-rest-data [options]**

## Description

Extract data from REST API endpoints into CSV files. Supports pagination (offset, cursor, link header, page number), authentication (bearer, API key, basic, OAuth2), rate limiting, and parent-child endpoint relationships.

The extracted CSV files can then be ingested using `starlake load`.

See [REST API Extraction Guide](/guides/extract/extract-rest-api).

## Examples

```bash
starlake extract-rest-data --config my-rest-api --outputDir /tmp/api-data
starlake extract-rest-data --config my-rest-api --outputDir /tmp/api-data --incremental
starlake extract-rest-data --config my-rest-api --outputDir /tmp/api-data --limit 1000
starlake extract-rest-data --config my-rest-api --outputDir /tmp/api-data --parallelism 4
```

## Parameters

Parameter|Cardinality|Description
---|---|---
--config `<value>`|*Required*|REST API extraction config file (in metadata/extract/)
--outputDir `<value>`|*Required*|Where to output CSV files
--limit `<value>`|*Optional*|Limit number of records per endpoint
--parallelism `<value>`|*Optional*|Parallelism level for endpoint extraction. Default: available CPU cores
--incremental|*Optional*|Only extract new data since last extraction. Uses incrementalField from endpoint config.
--reportFormat `<value>`|*Optional*|Report format: console, json, html