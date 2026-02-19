---
sidebar_position: 110
title: esload
description: "Load datasets in parquet, JSON, or JSON-array format into Elasticsearch indices with custom mappings and Spark configuration."
keywords:
  - starlake esload
  - Elasticsearch load
  - data indexing
  - Elasticsearch Spark
---


## Synopsis

**starlake esload [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--timestamp `<value>`|*Optional*|Elasticsearch index timestamp suffix as in `{@timestamp\|yyyy.MM.dd}`
--id `<value>`|*Optional*|Elasticsearch Document Id
--mapping `<value>`|*Optional*|Path to Elasticsearch Mapping File
--domain `<value>`|*Required*|Domain Name
--schema `<value>`|*Required*|Schema Name
--format `<value>`|*Required*|Dataset input file : parquet, json or json-array
--dataset `<value>`|*Optional*|Input dataset path
--conf `es.batch.size.entries=1000, es.batch.size.bytes=1mb...`|*Optional*|esSpark configuration options. See https://www.elastic.co/guide/en/elasticsearch/hadoop/current/configuration.html