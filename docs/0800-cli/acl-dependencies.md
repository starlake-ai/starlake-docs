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
--all|*Optional*|Include all ACL in the dot file ? None by default
--grantees `<value>`|*Optional*|Which users should we include in the dot file ? All by default
--json|*Optional*|Should we generate JSON files ?
--output `<value>`|*Optional*|Where to save the generated dot file ? Output to the console by default
--reload|*Optional*|Should we reload the domains first ?
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--tables `<value>`|*Optional*|Which tables should we include in the dot file ? All by default