---
sidebar_position: 220
title: load
---


## Synopsis

**starlake load [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--domains:`domain1,domain2...`|*Optional*|Domains to watch
--tables:`table1,table2,table3 ...`|*Optional*|Tables to watch
--include:`domain1,domain2...`|*Optional*|Deprecated: Domains to watch
--schemas:`schema1,schema2,schema3...`|*Optional*|Deprecated: Schemas to watch
--accessToken:`<value>`|*Optional*|Access token to use for authentication
--options:`k1=v1,k2=v2...`|*Optional*|Watch arguments to be used as substitutions
--test:`<value>`|*Optional*|Should we run this load as a test ? Default value is false
--files:`<value>`|*Optional*|load this file only