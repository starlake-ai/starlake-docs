---
sidebar_position: 240
title: metrics
description: "Compute and publish data quality metrics for a given domain and schema, with optional Google Cloud authentication."
keywords: [starlake metrics, data quality, schema metrics, data profiling]
---


## Synopsis

**starlake metrics [options]**

## Description

Compute data quality metrics (continuous, discrete, and frequency metrics) on loaded tables. See [Metrics Guide](/guides/load/metrics).

## Parameters

Parameter|Cardinality|Description
---|---|---
--domain `<value>`|*Required*|Domain Name
--schema `<value>`|*Required*|Schema Name
--authInfo `<value>`|*Optional*|Auth Info.  Google Cloud use: gcpProjectId and gcpSAJsonKey