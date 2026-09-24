---
title: "DuckDB access control: roles, grants, row and column security"
sidebar_label: Access control
description: "Add users, roles, grants, row-level security and column masking to DuckDB. Quack on Demand checks every statement against an ACL before it reaches a DuckDB node."
keywords: [duckdb access control, duckdb acl, duckdb rbac, duckdb row-level security, duckdb column masking, duckdb permissions, duckdb grant, ducklake access control]
---

DuckDB has no users and no `GRANT`: whoever can open the file reads every table. Quack on Demand puts a gateway in front of DuckDB that authenticates each connection and checks every statement against roles, table grants, row policies and column masks before it reaches a node.

## The problem

An embedded engine trusts its process. That is fine for one analyst on a laptop and breaks the moment two teams share a DuckDB or DuckLake dataset: there is no way to say that finance may read `orders` but not `salaries`, that a regional manager sees only their region, or that an email column must be hashed for everyone except support. Copying files per audience or hiding tables behind views does not hold up, because the engine still trusts whoever holds the file.

## How Quack on Demand does it

Set `QOD_ACL_ENABLED=true` and every statement, whether it arrives over Arrow Flight SQL, DuckDB's native Quack protocol or the MCP server, is matched against the caller's effective permission set. Roles bundle table verbs (`RO`, `RW`, `DDL`, `ALL`) on `catalog.schema.table` triples with wildcards. Groups collect roles and pool grants. A user reaches permissions directly or through their groups, and admission to a pool is what admits them to that pool's database. Row policies rewrite a matching `SELECT` with a filter, and column policies mask or deny a column, all before the SQL reaches DuckDB.

You can manage all of it from the admin UI, the `qod` CLI, or plain SQL from any connected client:

```sql
CREATE ROLE analyst;
GRANT SELECT ON acme_tpch.tpch1.customer TO ROLE analyst;
GRANT ROLE analyst TO GROUP finance;
GRANT CONNECT ON POOL bi TO GROUP finance;

CREATE OR REPLACE ROW POLICY ON acme_tpch.tpch1.orders FOR ROLE analyst
  USING (region = ${tenantId} OR owner = ${user});

CREATE OR REPLACE COLUMN POLICY ON acme_tpch.tpch1.customer COLUMN c_email
  FOR ROLE analyst MASK USING (SHA256(CAST(c_email AS VARCHAR)));
```

Every grant, denial and policy change lands in the audit log. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Access control model](/qod/operating/rbac-model): entities, the effective set, the two gates, row and column policies in full.
- [Grant and revoke access](/qod/administration/access-control): step-by-step playbooks in the UI and CLI.
- [Administer with SQL](/qod/administration/sql-administration): the complete SQL admin grammar.
- [Administering access](/qod/operating/rbac-admin): CLI recipes for users, roles, groups and pool grants.
- [Audit log](/qod/administration/audit-log): what is recorded and where.
