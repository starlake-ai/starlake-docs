---
sidebar_position: 430
title: test
description: "Run unit tests for load and transform tasks on specific domains and tables, with optional HTML report generation."
keywords: [starlake test, data testing, unit tests, data validation, test report]
---


## Synopsis

**starlake test [options]**

## Description
Run unit tests for load and transform tasks using sample data and expected results. See [Unit Tests Guide](/starflow/guides/unit-tests/concepts).

## Parameters

Parameter|Cardinality|Description
---|---|---
--accessToken `<value>`|*Optional*|Access token to use for authentication
--domain `<value>`|*Optional*|Test this domain only
--load|*Optional*|Test load tasks only
--outputDir `<value>`|*Optional*|Where to output the tests
--reportFormat `<value>`|*Optional*|Report format: console, json, html
--site|*Optional*|Generate the results of the tests as a website
--table `<value>`|*Optional*|Test this table or task only in the selected domain
--test `<value>`|*Optional*|Test this test only in the domain and table/task selected
--transform|*Optional*|Test transform tasks only