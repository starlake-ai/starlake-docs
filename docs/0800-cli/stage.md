---
sidebar_position: 320
title: stage
description: "Move and uncompress files from the landing area to the pending area, handling ack files and domain-based directories."
keywords: [starlake stage, file staging, data landing zone, file import, ETL]
---


## Synopsis

**starlake stage [options]**

## Description

Move files from the landing directory to the pending directory, applying optional file-level transformations.

## Parameters

Parameter|Cardinality|Description
---|---|---
--domains `domain1,domain2...`|*Optional*|Domains to stage
--tables `table1,table2...`|*Optional*|Tables to stage
--options `k1=v1,k2=v2...`|*Optional, Unbounded*|Stage arguments to be used as substitutions