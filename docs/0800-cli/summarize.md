---
sidebar_position: 330
title: summarize
description: "Generate a statistical summary for a specific domain and table, providing key data profiling insights at a glance."
keywords: [starlake summarize, data summary, data profiling, table statistics]
---


## Synopsis

**starlake summarize [options]**

## Description

Display a summary of table schemas including column names, types, and descriptions.

## Parameters

Parameter|Cardinality|Description
---|---|---
--domain `domain1`|*Required*|Domain Name
--table `table`|*Required*|Tables Name
--accessToken `<value>`|*Optional*|Access token to use for authentication