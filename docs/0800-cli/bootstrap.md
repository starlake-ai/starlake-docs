---
sidebar_position: 30
title: bootstrap
description: "Create a new Starlake project from scratch or from a template such as quickstart or userguide with a single command."
keywords: [starlake bootstrap, project setup, quickstart, project template]
---


## Synopsis

**starlake bootstrap [options]**

## Description

Create a new Starlake project from a template. Generates the required directory structure and sample configuration files to get started quickly. See [Project Setup Guide](/guides/project-setup/starlake-project-setup).

Create a new project optionally based on a specific template eq. quickstart / userguide


## Parameters

Parameter|Cardinality|Description
---|---|---
--no-exit `<value>`|*Optional*|Should we exit after project creation ?
--template `<value>`|*Optional*|Template to use to bootstrap project
--project-location `<value>`|*Optional*|Absolute path where the project should be created
--reportFormat `<value>`|*Optional*|Report format: console, json, html