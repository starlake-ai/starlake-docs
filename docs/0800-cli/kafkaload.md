---
sidebar_position: 200
title: kafkaload
---


## Synopsis

**starlake kafkaload [options]**

## Description

Two modes are available : The batch mode and the streaming mode.

### Batch mode
In batch mode, you start the kafka (off)loader regurarly and the last consumed offset
will be stored in the `comet_offsets` topic config
(see [reference-kafka.conf](https://github.com/starlake-ai/starlake/blob/master/src/main/resources/reference-kafka.conf#L22) for an example).

When offloading data from kafka to a file, you may ask to coalesce the result to a specific number of files / partitions.
If you ask to coalesce to a single partition, the offloader will store the data in the exact filename you provided in the path
argument.

The figure below describes the batch offloading process
![](/img/cli/kafka-offload.png)

The figure below describes the batch offloading process with `comet-offsets-mode = "FILE"`
![](/img/cli/kafka-offload-fs.png)

### Streaming mode

In this mode, te program keep running and you the comet_offsets topic is not used. The (off)loader will use a consumer group id
you specify in the access options of the topic configuration you are dealing with.


## Parameters

Parameter|Cardinality|Description
---|---|---
--config:`<value>`|*Optional*|Topic Name declared in reference.conf file
--connectionRef:`<value>`|*Optional*|Connection to any specific sink
--format:`<value>`|*Optional*|Read/Write format eq : parquet, json, csv ... Default to parquet.
--path:`<value>`|*Optional*|Source file for load and target file for store
--options:`<value>`|*Optional*|Options to pass to Spark Reader
--write-config:`<value>`|*Optional*|Topic Name declared in reference.conf file
--write-path:`<value>`|*Optional*|Source file for load and target file for store
--write-mode:`<value>`|*Optional*|When offload is true, describes how data should be stored on disk. Ignored if offload is false.
--write-options:`<value>`|*Optional*|Options to pass to Spark Writer
--write-format:`<value>`|*Optional*|Streaming format eq. kafka, console ...
--write-coalesce:`<value>`|*Optional*|Should we coalesce the resulting dataframe
--transform:`<value>`|*Optional*|Any transformation to apply to message before loading / offloading it
--stream:`<value>`|*Optional*|Should we use streaming mode ?
--streaming-trigger:`<value>`|*Optional*|Once / Continuous / ProcessingTime
--streaming-trigger-option:`<value>`|*Optional*|10 seconds for example. see https://spark.apache.org/docs/latest/api/java/org/apache/spark/sql/streaming/Trigger.html#ProcessingTime-java.lang.String-
--streaming-to-table:`<value>`|*Optional*|Table name to sink to
--streaming-partition-by:`<value>`|*Optional*|List of columns to use for partitioning