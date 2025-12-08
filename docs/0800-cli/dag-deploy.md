---
sidebar_position: 90
title: dag-deploy
---


## Synopsis

**starlake dag-deploy [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--inputDir `<value>`|*Optional*|Folder containing DAGs previously generated using the dag-generate command
--outputDir `<value>`|*Required*|Path where to deploy the library files. This is the root of all DAGs
--dagDir `<value>`|*Optional*|outputDir's sub-directory where to deploy the DAG files.
--clean `<value>`|*Optional*|Should the output directory be deleted first ?