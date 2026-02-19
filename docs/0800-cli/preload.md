---
sidebar_position: 270
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
--options `k1=v1,k2=v2...`|*Optional*|Pre load arguments to be used as substitutions