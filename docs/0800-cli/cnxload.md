---
sidebar_position: 50
title: cnxload
description: "Load a parquet source file into a JDBC table with configurable connection options and write strategies like APPEND or OVERWRITE."
keywords:
  - starlake cnxload
  - parquet to JDBC
  - database loading
  - connection load
---


## Synopsis

**starlake cnxload [options]**

## Description

Load parquet file into JDBC Table.


## Parameters

Parameter|Cardinality|Description
---|---|---
--source_file `<value>`|*Required*|Full Path to source file
--output_table `<value>`|*Required*|JDBC Output Table
--options `<value>`|*Optional*|Connection options eq for jdbc : driver, user, password, url, partitions, batchSize
--write_strategy `<value>`|*Optional*|One of the write strategies: APPEND, OVERWRITE (see strategy types)