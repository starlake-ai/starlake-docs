---
sidebar_position: 90
title: dag-deploy
description: "Deploy previously generated DAG files and library dependencies to a target directory for orchestration tools like Airflow."
keywords: [starlake dag-deploy, DAG deployment, Airflow, workflow orchestration]
---


## Synopsis

**starlake dag-deploy [options]**

## Description
Deploy generated DAG files and their library dependencies to the orchestrator's DAG directory. Run this after `dag-generate` to publish workflow definitions to Airflow or another scheduler. See [Orchestration Guide](/guides/orchestrate/tutorial).

## Parameters

Parameter|Cardinality|Description
---|---|---
--inputDir `<value>`|*Optional*|Folder containing DAGs previously generated using the dag-generate command
--outputDir `<value>`|*Required*|Path where to deploy the library files. This is the root directory for all DAGs
--dagDir `<value>`|*Optional*|Optional outputDir's sub-directory where to deploy the DAG files if DAGs should not be deployed at the root level.<br />DAGs are usually deployed in a subdirectory named after the project name (parent folder of the metadata directory by default)<br />
--clean `<value>`|*Optional*|Should the output directory be deleted first ?
--reportFormat `<value>`|*Optional*|Report format: console, json, html