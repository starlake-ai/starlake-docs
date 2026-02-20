---
sidebar_position: 140
title: extract-data
description: "Extract data from any database in parallel with support for partitioning, incremental exports, and configurable parallelism."
keywords:
  - starlake extract-data
  - database extraction
  - parallel data export
  - incremental extraction
  - data pipeline
---


## Synopsis

**starlake extract-data [options]**

## Description

Extract data from a JDBC database into CSV or Parquet files. Supports incremental extraction, parallel partitioning, and selective table filtering for efficient large-scale data exports. See [Extract Tutorial](/guides/extract/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---
--config `<value>`|*Required*|Database tables & connection info
--limit `<value>`|*Optional*|Limit number of records
--numPartitions `<value>`|*Optional*|parallelism level regarding partitionned tables
--parallelism `<value>`|*Optional*|parallelism level of the extraction process. By default equals to the available cores: 16
--ignoreExtractionFailure `<value>`|*Optional*|Don't fail extraction job when any extraction fails.
--clean `<value>`|*Optional*|Clean all files of table only when it is extracted.
--outputDir `<value>`|*Required*|Where to output csv files
--incremental `<value>`|*Optional*|Export only new data since last extraction.
--ifExtractedBefore `<value>`|*Optional*|DateTime to compare with the last beginning extraction dateTime. If it is before that date, extraction is done else skipped.
--includeSchemas `schema1,schema2`|*Optional*|Domains to include during extraction.
--excludeSchemas `schema1,schema2...`|*Optional*|Domains to exclude during extraction. if `include-domains` is defined, this config is ignored.
--includeTables `table1,table2,table3...`|*Optional*|Schemas to include during extraction.
--excludeTables `table1,table2,table3...`|*Optional*|Schemas to exclude during extraction. if `include-schemas` is defined, this config is ignored.
-- `<value>`|*Optional*|