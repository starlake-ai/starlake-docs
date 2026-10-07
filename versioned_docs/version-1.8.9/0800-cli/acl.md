---
sidebar_position: 10
title: acl
description: "Export all ACL and Row Level Security entries to a Starlake Data Stack YAML file. Supports local and cloud filesystem paths."
keywords: [starlake acl, ACL export, row level security, access control, RLS]
---


## Synopsis

**starlake acl [options]**

## Description
Export all ACL and Row Level Security entries from domain and task definitions to a markdown file.

## Parameters

Parameter|Cardinality|Description
---|---|---
--export `<value>`|*Required*|Export ACL and RLS entries to a file
--outputPath `<value>`|*Required*|Path to output file (local or cloud filesystem, e.g. /path/to/acl.md or gs://bucket/acl.md)
--reportFormat `<value>`|*Optional*|Report format: console, json, html