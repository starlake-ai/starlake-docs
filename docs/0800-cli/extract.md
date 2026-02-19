---
sidebar_position: 120
title: extract
description: "Top-level extract command that groups sub-commands for extracting data, schemas, scripts, and BigQuery metadata."
keywords:
  - starlake extract
  - data extraction
  - schema extraction
  - database export
---


## Synopsis

**starlake extract [options]**

## Description

Run both `extract-schema` and `extract-data` in sequence for a given configuration. This is the recommended way to extract table schemas and data from a JDBC database in a single step. See [Extract Tutorial](/guides/extract/tutorial).

## Parameters

This command accepts the combined options of `extract-schema` and `extract-data`.

Parameter|Cardinality|Description
---|---|---
--config `<value>`|*Required*|Database tables & connection info
--outputDir `<value>`|*Required*|Where to output files (YML schemas and CSV data)
--tables `<value>`|*Optional*|Database tables to extract
--connectionRef `<value>`|*Optional*|Database connection to use
--all|*Optional*|Extract all schemas and tables to external folder
--external|*Optional*|Output YML files in the external folder
--parallelism `<value>`|*Optional*|Parallelism level of the extraction process. By default equals to the available cores
--snakecase|*Optional*|Apply snake case when name sanitization is done
--limit `<value>`|*Optional*|Limit number of records
--numPartitions `<value>`|*Optional*|Parallelism level regarding partitioned tables
--ignoreExtractionFailure|*Optional*|Don't fail extraction job when any extraction fails
--clean|*Optional*|Clean all files of table only when it is extracted
--incremental|*Optional*|Export only new data since last extraction
--ifExtractedBefore `<value>`|*Optional*|DateTime to compare with the last beginning extraction dateTime. If it is before that date, extraction is done else skipped
--includeSchemas `<value>`|*Optional*|Domains to include during extraction
--excludeSchemas `<value>`|*Optional*|Domains to exclude during extraction. If `includeSchemas` is defined, this option is ignored
--includeTables `<value>`|*Optional*|Tables to include during extraction
--excludeTables `<value>`|*Optional*|Tables to exclude during extraction. If `includeTables` is defined, this option is ignored