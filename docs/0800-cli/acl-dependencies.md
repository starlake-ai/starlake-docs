---
sidebar_position: 20
title: acl-dependencies
description: "Generate DOT or JSON files visualizing ACL dependencies from Domain and Schema YAML definitions."
keywords: [starlake acl-dependencies, ACL dependencies, DOT, access control, data governance]
---


## Synopsis

**starlake acl-dependencies [options]**

## Description
Generate an ACL (Access Control List) dependency graph showing which roles and permissions apply across tables and domains. Use this command to visualize access control relationships as DOT or JSON files.

Generate DOT or JSON files from Domain / Schema YAML files

## Parameters

Parameter|Cardinality|Description
---|---|---
--output `<value>`|*Optional*|Where to save the generated dot file ? Output to the console by default
--grantees `<value>`|*Optional*|Which users should we include in the dot file ? All by default
--reload `<value>`|*Optional*|Should we reload the domains first ?
--json `<value>`|*Optional*|Should we generate JSON files ?
--tables `<value>`|*Optional*|Which tables should we include in the dot file ? All by default
--all `<value>`|*Optional*|Include all ACL in the dot file ? None by default
--reportFormat `<value>`|*Optional*|Report format: console, json, html