---
sidebar_position: 430
title: yml2xls
description: "Export IAM policy tags from YAML definitions to Excel spreadsheets."
keywords: [starlake yml2xls-iam-policy-tags, IAM policy tags, Excel export, access control]
---


## Synopsis

**starlake $command [options]**

## Description
Export Starlake YAML domain and table definitions to an Excel spreadsheet.

## Parameters

Parameter|Cardinality|Description
---|---|---
--domain `<value>`|*Optional*|domains to convert to XLS
--iamPolicyTagsFile `<value>`|*Optional*|IAM PolicyTag file to convert to XLS, SL_METADATA/iam-policy-tags.sl.yml by default)
--xls `<value>`|*Required*|directory where XLS files are generated
--reportFormat `<value>`|*Optional*|Report format: console, json, html