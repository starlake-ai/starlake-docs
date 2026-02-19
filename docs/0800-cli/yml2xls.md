---
sidebar_position: 410
title: yml2xls
description: "Export Starlake YAML domain definitions and IAM policy tags to Excel spreadsheets for review and collaboration."
keywords: [starlake yml2xls, YAML to Excel, schema export, data documentation, IAM policy tags]
---


## Synopsis

**starlake $command [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--domain `<value>`|*Optional*|domains to convert to XLS
--iamPolicyTagsFile `<value>`|*Optional*|IAM PolicyTag file to convert to XLS, SL_METADATA/iam-policy-tags.sl.yml by default)
--xls `<value>`|*Required*|directory where XLS files are generated