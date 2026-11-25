---
sidebar_position: 240
title: infer-schema
description: "Automatically infer and generate YAML schema definitions from input datasets in CSV, JSON, XML, or Parquet format."
keywords: [starlake infer-schema, schema inference, YAML generation, data discovery]
---


## Synopsis

**starlake infer-schema [options]**

## Description
Infer a Starflow table schema from a sample data file (CSV, JSON, etc.) and generate the corresponding YAML configuration. See [Load Tutorial](/starflow/guides/load/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---
--clean|*Optional*|Delete previous YML before writing
--domain `<value>`|*Optional*|Domain Name
--encoding `<value>`|*Optional*|Input file encoding. Default to UTF-8
--format `<value>`|*Optional*|Force input file format
--from-json-schema|*Optional*|Input file is a valid JSON Schema
--input `<value>`|*Required*|Dataset Input Path
--outputDir `<value>`|*Optional*|Domain YAML Output Path
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--rowTag `<value>`|*Optional*|row tag to use if detected format is XML
--table `<value>`|*Optional*|Table Name
--variant|*Optional*|Infer schema as a single variant attribute
--write `<value>`|*Optional*|One of Set(OVERWRITE, APPEND)