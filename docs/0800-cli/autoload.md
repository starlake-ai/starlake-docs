---
sidebar_position: 20
title: autoload
description: "Automatically watch and load incoming data files into specified domains and tables with optional scheduling and substitutions."
keywords:
  - starlake autoload
  - data ingestion
  - auto load watch
  - scheduled data loading
---


## Synopsis

**starlake autoload [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--domains `domain1,domain2...`|*Optional*|Domains to watch
--tables `table1,table2,table3 ...`|*Optional*|Tables to watch
--clean `<value>`|*Optional*|Overwrite existing mapping files before starting
--accessToken `<value>`|*Optional*|Access token to use for authentication
--scheduledDate `<value>`|*Optional*|Scheduled date for the job, in format yyyy-MM-dd'T'HH:mm:ss.SSSZ
--options `k1=v1,k2=v2...`|*Optional*|Watch arguments to be used as substitutions