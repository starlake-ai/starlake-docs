---
sidebar_position: 160
title: extract-script
description: "Generate database extraction scripts from domain schemas using Mustache templates for tools like sqlplus or pgsql export."
keywords:
  - starlake extract-script
  - extraction script generation
  - Mustache template
  - database export script
---


## Synopsis

**starlake extract-script [options]**

## Description

Generate extraction shell scripts from a Mustache template for batch database extraction workflows. Use this to produce tool-specific export scripts (e.g., sqlplus for Oracle, pgsql for PostgreSQL) based on your domain schema definitions.

## Parameters

Parameter|Cardinality|Description
---|---|---
--domain `domain1,domain2 ...`|*Optional*|The domain list for which to generate extract scripts
--template `<value>`|*Required*|Script template dir
--audit-schema `<value>`|*Required*|Audit DB that will contain the audit export table
--delta-column `<value>`|*Optional*|The default date column used to determine new rows to export. Overrides config database-extractor.default-column value.