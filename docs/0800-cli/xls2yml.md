---
sidebar_position: 380
title: xls2yml
description: "Convert Excel files describing domains and schemas into Starlake YAML configuration files with optional IAM policy tags."
keywords: [starlake xls2yml, Excel to YAML, schema generation, data modeling, IAM policy]
---


## Synopsis

**starlake xls2yml [options]**

## Description

Convert Excel spreadsheet domain definitions into Starlake YAML configuration files.

## Parameters

Parameter|Cardinality|Description
---|---|---
--files `<value>`|*Required*|List of Excel files describing domains & schemas or jobs
--iamPolicyTagsFile `<value>`|*Optional*|If true generate IAM PolicyTags YML
--outputDir `<value>`|*Optional*|Path for saving the resulting YAML file(s). Starlake domains path is used by default.
--policyFile `<value>`|*Optional*|Optional File for centralising ACL & RLS definition.
--job `<value>`|*Optional*|If true generate YML for a Job.