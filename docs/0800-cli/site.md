---
sidebar_position: 380
title: site
description: "Generate a documentation site from your Starflow project."
keywords: [starlake site, documentation generation, data catalog, lineage, project docs]
---


## Synopsis

**starlake site [options]**

## Description

Generate a documentation site from your Starflow project: tables, tasks, columns, doc blocks and project-wide lineage. The output folder holds sl-model.json and a static index.html that also opens from the file system. See [Documentation site guide](/starflow/guides/documentation/starlake-site-builder).


## Parameters

Parameter|Cardinality|Description
---|---|---
--outputDir `<value>`|*Optional*|Output directory (default: ./site)
--clean `<value>`|*Optional*|Delete the output directory before generating the site
--stats `<value>`|*Optional*|Query each connection's metadata (row count, size, last modified, actual column types) and write sl-stats.json. Never reads table data.
--statsTimeout `<value>`|*Optional*|Per-connection timeout in seconds for --stats (default: 120)
--serve `<value>`|*Optional*|After generating, serve the site on 127.0.0.1, on the --port port, until Ctrl-C
--port `<value>`|*Optional*|Port used by --serve (default: 8080)