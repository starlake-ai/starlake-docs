---
sidebar_position: 150
title: extract-schema
---


## Synopsis

**starlake extract-schema [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--config:`<value>`|*Optional*|Database tables & connection info
--tables:`<value>`|*Optional*|Database tables info
--connectionRef:`<value>`|*Optional*|Database connection to use
--outputDir:`<value>`|*Optional*|Where to output YML files
--external:`<value>`|*Optional*|Should we output YML files in the external folder
--parallelism:`<value>`|*Optional*|parallelism level of the extraction process. By default equals to the available cores
--snakecase:`<value>`|*Optional*|Apply snake case when name sanitization is done