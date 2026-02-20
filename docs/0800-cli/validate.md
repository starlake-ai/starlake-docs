---
sidebar_position: 370
title: validate
description: "Validate your Starlake project configuration by reloading all YAML files from disk and checking for errors or warnings."
keywords: [starlake validate, project validation, YAML validation, configuration check]
---


## Synopsis

**starlake validate [options]**

## Description

Validate the Starlake project configuration files and optionally test database connections.

## Parameters

Parameter|Cardinality|Description
---|---|---
--reload `<value>`|*Optional*|Reload all files from disk before starting validation. Always true regardless of the value set here.