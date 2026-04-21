---
sidebar_position: 210
title: iam-policies
description: "Generate and apply IAM policies for your Starlake project resources, managing access control with authentication tokens."
keywords: [starlake iam-policies, IAM policies, access control, security]
---


## Synopsis

**starlake iam-policies [options]**

## Description
Apply IAM (Identity and Access Management) policies defined in Starlake YAML configuration to the target warehouse.

## Parameters

Parameter|Cardinality|Description
---|---|---
--accessToken `<value>`|*Optional*|Access token to use for authentication
--reportFormat `<value>`|*Optional*|Report format: console, json, html