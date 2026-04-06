---
sidebar_position: 410
title: xls2yml
description: "Convert Excel files describing domains, schemas and attributes into Starlake YAML configuration files."
keywords: [starlake xls2yml, Excel to YAML, schema generation, data modeling, domain definition]
---


## Synopsis

**starlake xls2yml [options]**

## Description
Generate Starlake YAML configuration files from Excel spreadsheets.

## Parameters

Parameter|Cardinality|Description
---|---|---
--files `<value>`|*Required*|List of Excel files describing domains & schemas or jobs
--iamPolicyTagsFile `<value>`|*Optional*|If true generate IAM PolicyTags YML
--outputDir `<value>`|*Optional*|Path for saving the resulting YAML file(s). Starlake domains path is used by default.
--policyFile `<value>`|*Optional*|Optional File for centralising ACL & RLS definition.
--job `<value>`|*Optional*|If true generate YML for a Job.
--reportFormat `<value>`|*Optional*|Report format: console, json, html