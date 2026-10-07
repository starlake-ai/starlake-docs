---
sidebar_position: 350
title: serve
description: "Start a local Starflow HTTP server on a configurable host and port to serve API requests for your data project."
keywords: [starlake serve, local server, HTTP API, development server]
---


## Synopsis

**starlake serve [options]**

## Description
Start the Starflow HTTP server for running commands via REST API.

## Parameters

Parameter|Cardinality|Description
---|---|---
--host `<value>`|*Optional*|address on which the server is listening
--port `<value>`|*Optional*|Port on which the server is listening
--reportFormat `<value>`|*Optional*|Report format: console, json, html