---
sidebar_position: 190
title: infer-schema
description: "Automatically infer and generate YAML schema definitions from input datasets in CSV, JSON, XML, or Parquet format."
keywords:
  - starlake infer-schema
  - schema inference
  - YAML schema generation
  - data type detection
---


## Synopsis

**starlake infer-schema [options]**

## Description

Infer a Starlake table schema from a sample data file (CSV, JSON, etc.) and generate the corresponding YAML configuration. See [Load Tutorial](/guides/load/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---
--domain `<value>`|*Optional*|Domain Name
--table `<value>`|*Optional*|Table Name
--input `<value>`|*Required*|Dataset Input Path
--outputDir `<value>`|*Optional*|Domain YAML Output Path
--write `<value>`|*Optional*|One of Set(OVERWRITE, APPEND)
--format `<value>`|*Optional*|Force input file format
--rowTag `<value>`|*Optional*|row tag to use if detected format is XML
--variant|*Optional*|Infer schema as a single variant attribute
--clean|*Optional*|Delete previous YML before writing
--encoding `<value>`|*Optional*|Input file encoding. Default to UTF-8
--from-json-schema|*Optional*|Input file is a valid JSON Schema