---
sidebar_position: 190
title: infer-schema
---


## Synopsis

**starlake infer-schema [options]**

## Description


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
--variant `<value>`|*Optional*|Infer schema as a single variant attribute
--clean `<value>`|*Optional*|Delete previous YML before writing
--encoding `<value>`|*Optional*|Input file encoding. Default to UTF-8