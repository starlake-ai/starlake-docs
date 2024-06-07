---
sidebar_position: 120
title: extract-bq-schema
---


## Synopsis

**starlake extract-bq-schema [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--write:`<value>`|*Optional*|One of Set(OVERWRITE, APPEND)
--connection:`<value>`|*Optional*|Connection to use
--database:`<value>`|*Optional*|database / project id
--external:`<value>`|*Optional*|Include external datasets defined in _config.sl.yml instead of using other parameters of this command ? Defaults to false
--tables:`<value>`|*Optional*|List of datasetName.tableName1,datasetName.tableName2 ...
--accessToken:`<value>`|*Optional*|Access token to use for authentication
--persist:`<value>`|*Optional*|Persist results ?

