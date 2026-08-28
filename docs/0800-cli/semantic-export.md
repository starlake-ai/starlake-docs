---
sidebar_position: 340
title: semantic-export
description: "Export semantic models from metadata/semantic to Apache Ossie, a LookML project or a Power BI TMDL folder."
keywords: [starlake semantic-export, semantic model, semantic layer, apache ossie, lookml, looker, tmdl, power bi, open semantic interchange, BI, AI agents]
---


## Synopsis

**starlake semantic-export [options]**

## Description

Export the semantic models stored in metadata/semantic/ to another semantic
format. Supported formats: ossie (Apache Ossie, incubating), lookml (a Looker
project: one view file per table plus a model file with explores) and tmdl
(a Power BI TMDL folder: database.tmdl, model.tmdl, relationships.tmdl and
one `tables/<table>.tmdl` per table).

For ossie, Starlake-specific attributes with no Ossie counterpart are
preserved in custom_extensions blocks under the STARLAKE vendor name.

For lookml, --connection sets the Looker connection name in the model file.

For tmdl, --connection names the Starlake connection used to derive each
table's Power Query source; simple aggregate metrics are translated to DAX
and anything else becomes a BLANK() measure carrying the original SQL in a
TODO comment.

````shell
starlake semantic-export
         --format tmdl
         --model ecommerce_analytics
         --connection snowflake_prod
         --output /tmp/tmdl-models
````


## Parameters

Parameter|Cardinality|Description
---|---|---
--format `<value>`|*Optional*|Target format: ossie (default), lookml or tmdl
--model `<value>`|*Optional*|Name of a single semantic model to export (model 'name' field or file basename). All models by default
--output `<value>`|*Optional*|Output directory. Defaults to metadata/semantic/export/ with one subfolder per format
--connection `<value>`|*Optional*|lookml: Looker connection name written to the model file; tmdl: Starlake connection used to derive the Power Query source. Defaults to the project's connectionRef
--reportFormat `<value>`|*Optional*|Report format: console, json, html