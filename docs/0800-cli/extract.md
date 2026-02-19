---
sidebar_position: 120
title: extract
description: "Top-level extract command that groups sub-commands for extracting data, schemas, scripts, and BigQuery metadata."
keywords:
  - starlake extract
  - data extraction
  - schema extraction
  - database export
---


## Synopsis

**starlake extract [options]**

## Description

Run both `extract-schema` and `extract-data` in sequence, extracting table definitions and their data from a source database in one step. See [Extract Tutorial](/guides/extract/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---