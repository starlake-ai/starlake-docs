---
sidebar_position: 350
title: semantic-export
description: "Export semantic models from metadata/semantic to a vendor-neutral interchange format (Apache Ossie)."
keywords: [starlake semantic-export, semantic model, semantic layer, apache ossie, open semantic interchange, BI, AI agents]
---


## Synopsis

**starlake semantic-export [options]**

## Description

Export the semantic models stored in metadata/semantic/ to a vendor-neutral
interchange format. Currently supported format: ossie (Apache Ossie, incubating,
formerly Open Semantic Interchange).

Fields, primary keys, relationships, and metrics are mapped to their Ossie
equivalents; Starlake-specific attributes with no Ossie counterpart (filters,
sample values, verified query SQL, join types...) are preserved in
custom_extensions blocks under the STARLAKE vendor name so no information is lost.

````shell
starlake semantic-export
         --format ossie
         --model ecommerce_analytics
         --output /tmp/ossie-models
````


## Parameters

Parameter|Cardinality|Description
---|---|---
--format `<value>`|*Optional*|Target interchange format. Only 'ossie' is supported for now (default)
--model `<value>`|*Optional*|Name of a single semantic model to export (model 'name' field or file basename). All models by default
--output `<value>`|*Optional*|Output directory. Defaults to metadata/semantic/export/ with one subfolder per format
--reportFormat `<value>`|*Optional*|Report format: console, json, html