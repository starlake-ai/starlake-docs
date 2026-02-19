---
sidebar_position: 350
title: test
description: "Run unit tests for load and transform tasks on specific domains and tables, with optional HTML report generation."
keywords: [starlake test, data testing, unit tests, data validation, test report]
---


## Synopsis

**starlake test [options]**

## Description

Run unit tests for load and transform tasks using sample data and expected results. See [Unit Tests Guide](/guides/unit-tests/concepts).

## Parameters

Parameter|Cardinality|Description
---|---|---
--load `<value>`|*Optional*|Test load tasks only
--transform `<value>`|*Optional*|Test transform tasks only
--domain `<value>`|*Optional*|Test this domain only
--table `<value>`|*Optional*|Test this table or task only in the selected domain
--test `<value>`|*Optional*|Test this test only in the domain and table/task selected
--site `<value>`|*Optional*|Generate the results of the tests as a website
--outputDir `<value>`|*Optional*|Where to output the tests
--accessToken `<value>`|*Optional*|Access token to use for authentication