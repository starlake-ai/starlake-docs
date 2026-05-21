---
sidebar_position: 330
title: quack
description: "Manage Quack DuckDB query servers — serve in foreground or detach as a background daemon."
keywords: [starlake quack, quack server, DuckLake, DuckDB remote, Quack extension]
---


## Synopsis

**starlake quack [options]**

## Description
Manage Quack DuckDB query servers.
Actions: serve, start, stop, list, stop-all

## Parameters

Parameter|Cardinality|Description
---|---|---
--action `<value>`|*Required*|Action to perform: serve, start, stop, list, stop-all
--connection `<value>`|*Optional*|Connection name (required for serve, start, stop)
--bind `<value>`|*Optional*|Bind address (default: 127.0.0.1; overrides quackBind connection option)
--port `<value>`|*Optional*|Port (default: 9494; overrides quackPort connection option)
--token `<value>`|*Optional*|Server token (overrides quackServerToken connection option)
--reportFormat `<value>`|*Optional*|Report format: console, json, html