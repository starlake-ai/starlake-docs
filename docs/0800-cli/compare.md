---
sidebar_position: 70
title: compare
---


## Synopsis

**starlake compare [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--path1 `<value>`|*Optional*|old version starlake project path
--path2 `<value>`|*Optional*|new version starlake project path
--gitWorkTree `<value>`|*Optional*|local path to git project (only if path1 or path2 if empty)
--commit1 `<value>`|*Optional*|old project commit id (SHA) - if path1 is empty
--commit2 `<value>`|*Optional*|new project commit id (SHA) - if path2 is empty
--tag1 `<value>`|*Optional*|old project git tag (latest for most recent tag) - if path1 and commit1 are empty
--tag2 `<value>`|*Optional*|new project git tag (latest for most recent tag) - if path2 and commit1 are empty
--template `<value>`|*Optional*|SSP / Mustache Template path
--output `<value>`|*Optional*|Output path