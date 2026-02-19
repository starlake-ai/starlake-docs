---
sidebar_position: 310
title: site
description: "Generate a documentation site from your Starlake project in JSON or Docusaurus MDX format with customizable templates."
keywords: [starlake site, documentation generation, docusaurus, data catalog, project docs]
---


## Synopsis

**starlake site [options]**

## Description

Generate a documentation portal from your Starlake project metadata (schemas, tasks, lineage). See [Site Builder Guide](/guides/documentation/starlake-site-builder).

## Parameters

Parameter|Cardinality|Description
---|---|---
--outputDir `<value>`|*Optional*|Output Directory
--template `<value>`|*Optional*|Template name or template path to use
--format `<value>`|*Optional*|json / docusaurus MDX
--clean `<value>`|*Optional*|Whether to clean the output directory before generating the site