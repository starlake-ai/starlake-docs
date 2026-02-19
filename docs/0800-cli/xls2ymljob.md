---
sidebar_position: 390
title: xls2ymljob
description: "Convert Excel files describing job definitions into Starlake YAML job configuration files with IAM policy tag support."
keywords: [starlake xls2ymljob, Excel to YAML, job generation, task configuration, IAM policy]
---


## Synopsis

**starlake xls2ymljob [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--files `<value>`|*Required*|List of Excel files describing domains & schemas or jobs
--iamPolicyTagsFile `<value>`|*Optional*|If true generate IAM PolicyTags YML
--outputDir `<value>`|*Optional*|Path for saving the resulting YAML file(s). Starlake domains path is used by default.
--policyFile `<value>`|*Optional*|Optional File for centralising ACL & RLS definition.
--job `<value>`|*Optional*|If true generate YML for a Job.