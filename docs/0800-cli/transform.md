---
sidebar_position: 360
title: transform
---


## Synopsis

**starlake transform [options]**

## Description


## Parameters

Parameter|Cardinality|Description
---|---|---
--name `<value>`|*Required*|Task Name in the form domain.task
--compile `<value>`|*Optional*|Return final query only
--sync-apply `<value>`|*Optional*|Update YAML attributes to match SQL query
--sync-preview `<value>`|*Optional*|Preview YAML attributes to match SQL query
--query `<value>`|*Optional*|Run this query instead of the one in the task
--dry-run `<value>`|*Optional*|Dry run only (supported on BigQuery only)
--tags `<value>`|*Optional*|Return final query only
--format `<value>`|*Optional*|pretty print the final query and update sql file
--interactive `<value>`|*Optional*|Run query without sinking the result. Valid parameters are: `csv`, `json`, `table`, `json-array`
--reload `<value>`|*Optional*|Reload YAML  files. Used in server mode
--truncate `<value>`|*Optional*|Force table to be truncated before insert. Default value is false
--pageSize `<value>`|*Optional*|Force table to be truncated before insert. Default value is false
--pageNumber `<value>`|*Optional*|Force table to be truncated before insert. Default value is false
--recursive `<value>`|*Optional*|Execute all dependencies recursively. Default value is false
--test `<value>`|*Optional*|Should we run this transform as a test ? Default value is false
--accessToken `<value>`|*Optional*|Access token to use for authentication
--options `k1=v1,k2=v2...`|*Optional, Unbounded*|Job arguments to be used as substitutions
--scheduledDate `<value>`|*Optional*|Scheduled date for the job, in format yyyy-MM-dd'T'HH:mm:ss.SSSZ