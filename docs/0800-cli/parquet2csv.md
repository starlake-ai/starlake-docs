---
sidebar_position: 260
title: parquet2csv
description: "Convert Parquet files to CSV format with configurable partitions, write modes, and Spark options like delimiter and header."
keywords: [starlake parquet2csv, parquet to csv, file conversion, data export, spark]
---


## Synopsis

**starlake parquet2csv [options]**

## Description

Convert Parquet files to CSV format for inspection or downstream processing.

## Parameters

Parameter|Cardinality|Description
---|---|---
--input_dir `<value>`|*Required*|Full Path to input directory
--output_dir `<value>`|*Optional*|Full Path to output directory, if not specified, input_dir is used as output dir
--domain `<value>`|*Optional*|Domain name to convert. All schemas in this domain are converted. If not specified, all schemas of all domains are converted
--schema `<value>`|*Optional*|Schema name to convert. If not specified, all schemas are converted.
--delete_source `<value>`|*Optional*|Should we delete source parquet files after conversion ?
--write_mode `<value>`|*Optional*|One of Set(OVERWRITE, APPEND)
--options `k1=v1,k2=v2...`|*Optional*|Any Spark option to use (sep, delimiter, quote, quoteAll, escape, header ...)
--partitions `<value>`|*Optional*|How many output partitions