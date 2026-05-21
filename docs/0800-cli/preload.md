---
sidebar_position: 320
title: preload
description: "Pre-load domains and tables using a configurable strategy before the main ingestion step, with global ack file support."
keywords: [starlake preload, data pre-loading, ingestion preparation, ETL pipeline]
---


## Synopsis

**starlake preload [options]**

## Description
Check for new files in the landing area and prepare them for loading.

## Parameters

Parameter|Cardinality|Description
---|---|---
--domain `domain1`|*Required*|Domain to pre load
--tables `table1,table2,table3 ...`|*Optional*|Tables to pre load
--strategy `<value>`|*Optional*|pre load strategy
--globalAckFilePath `<value>`|*Optional*|Global ack file path
--notReadySentinel `<value>`|*Optional*|If set, a zero-byte marker is written at this path when the pre-load decides files are not yet ready. Used by orchestrators to distinguish 'not ready, retry later' from real failures. In this mode, 'not ready' outcomes always exit with code 0 (the sentinel is the signal), while real exceptions still exit non-zero. Supports any StorageHandler-compatible URI (gs://, s3://, file://, hdfs://).
--options `k1=v1,k2=v2...`|*Optional*|Pre load arguments to be used as substitutions
--reportFormat `<value>`|*Optional*|Report format: console, json, html