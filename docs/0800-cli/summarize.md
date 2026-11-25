---
sidebar_position: 410
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
--accessToken `<value>`|*Optional*|Access token to use for authentication
--domain `domain1`|*Required*|Domain Name
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--table `table`|*Required*|Tables Name