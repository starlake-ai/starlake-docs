---
sidebar_position: 210
title: impact
description: "Report which load tables and transforms a change touches, how (breaking, non-breaking, metadata), and which downstream tasks it impacts, using column-level lineage. Runs offline."
keywords: [starlake impact, change impact, breaking change, column lineage, CI]
---


## Synopsis

**starlake impact [options]**

## Description
Compare two versions of the project and report direct changes and their downstream impact.
Default: merge-base(--base, HEAD) against the current project directory, uncommitted edits included.
Nothing is executed and no database connection is opened.
Exit codes: 0 report written, 1 --fail-on matched, 2 usage, git or project loading error.

## Parameters

Parameter|Cardinality|Description
---|---|---
--base `<value>`|*Optional*|git ref of the old side; the merge-base with --head (or HEAD) is used
--head `<value>`|*Optional*|git ref of the new side (default: the current project directory as is)
--path1 `<value>`|*Optional*|old project directory, instead of --base
--path2 `<value>`|*Optional*|new project directory, instead of --head
--env `<value>`|*Optional*|env used to render SQL variables
--format `<value>`|*Optional*|text (default), json, markdown or html
--output `<value>`|*Optional*|write the report to this local file instead of stdout; recommended in CI, where the launcher may print to stdout too
--template `<value>`|*Optional*|Jinja template for the html format; the values it receives are already HTML-escaped
--fail-on `<value>`|*Optional*|exit 1 when the report has a breaking change (breaking) or anything but metadata (non-breaking)