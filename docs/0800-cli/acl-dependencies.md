---
sidebar_position: 10
title: acl-dependencies
description: "Generate GraphViz dot, SVG, PNG or JSON files visualizing ACL dependencies from Domain and Schema YAML definitions."
keywords:
  - starlake acl-dependencies
  - access control visualization
  - GraphViz dot file
  - data governance
---


## Synopsis

**starlake acl-dependencies [options]**

## Description

Generate an ACL (Access Control List) dependency graph showing which roles and permissions apply across tables and domains. Use this command to visualize access control relationships as GraphViz dot, SVG, PNG, or JSON files.

## Parameters

Parameter|Cardinality|Description
---|---|---
--output `<value>`|*Optional*|Where to save the generated dot file ? Output to the console by default
--grantees `<value>`|*Optional*|Which users should we include in the dot file ? All by default
--reload `<value>`|*Optional*|Should we reload the domains first ?
--svg `<value>`|*Optional*|Should we generate SVG files ?
--json `<value>`|*Optional*|Should we generate JSON files ?
--png `<value>`|*Optional*|Should we generate PNG files ?
--tables `<value>`|*Optional*|Which tables should we include in the dot file ? All by default
--all `<value>`|*Optional*|Include all ACL in the dot file ? None by default