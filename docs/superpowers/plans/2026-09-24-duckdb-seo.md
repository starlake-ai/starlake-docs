# DuckDB Search Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make docs.starlake.ai rank and be cited for "DuckDB + access control / ACL / ADBC / SSO / authentication / multi-tenant / Flight SQL" queries.

**Architecture:** A new `qod/duckdb/` how-to hub with one page per search phrase, `description` and `keywords` frontmatter on every existing QoD page, site-level metadata and JSON-LD covering Quack on Demand, a corrected `llms.txt`, and internal links from the introduction, the landing page and the two DuckDB blog posts.

**Tech Stack:** Docusaurus 3.9.2 (two docs plugins: `docs` at `/starflow`, `qod` at `/qod`), Yarn, Node 20+. Spec: `docs/superpowers/specs/2026-09-24-duckdb-seo-design.md`.

## Global Constraints

- Never write the em dash character in any file.
- Existing QoD ids and URLs never change. No redirects are added.
- Every hub page states only capabilities already documented on a page it links to.
- Hub pages are 250 to 400 words; descriptions are 120 to 160 characters.
- `yarn build` must pass with `onBrokenLinks: "throw"` (already set).
- Commit after each task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Hub sidebar category is named exactly `DuckDB how-tos` and sits right after `Getting Started`.
- Deployment sentence on every hub page: "Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets."

---

### Task 1: Site-level metadata, OG image, structured data, landing description

**Files:**
- Modify: `docusaurus.config.js` (themeConfig.metadata, themeConfig.structuredData, add themeConfig.image)
- Modify: `src/components/StructuredData.js:41-43` (remove two console.log lines)
- Modify: `src/pages/qod/index.tsx:283-286` (Layout description)

**Interfaces:**
- Produces: `themeConfig.image = "img/social-card.png"`, `themeConfig.structuredData.about` as an array of two `SoftwareApplication` objects. Nothing later depends on names here.

- [ ] **Step 1: Baseline build to confirm the tree is green**

Run: `cd /Users/hayssams/git/public/starlake-docs && yarn build 2>&1 | tail -5`
Expected: last lines include `[SUCCESS] Generated static files in "build".`

- [ ] **Step 2: Replace the global metadata block**

In `docusaurus.config.js`, replace:

```js
    metadata: [
      {name: 'keywords', content: 'starlake, etl, data pipeline, data transformation'},
      {name: 'description', content: 'Official documentation for Starlake data pipeline platform'},
    ],
```

with:

```js
    image: "img/social-card.png",
    metadata: [
      {name: 'keywords', content: 'starlake, etl, data pipeline, data transformation, quack on demand, duckdb, ducklake, duckdb access control, duckdb acl, duckdb adbc, duckdb sso, duckdb authentication, duckdb multi-tenant, flight sql server'},
      {name: 'description', content: 'Documentation for Starlake, the declarative ETL platform, and Quack on Demand, the multi-tenant DuckDB gateway with access control, SSO, ADBC and Flight SQL.'},
    ],
```

- [ ] **Step 3: Replace the `about` object in structuredData with an array**

In `docusaurus.config.js`, replace:

```js
      "about": {
        "@type": "SoftwareApplication",
        "name": "Starlake",
        "applicationCategory": "Data Loading & Transformation Platform",
        "operatingSystem": "Cross-platform",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      },
```

with:

```js
      "about": [
        {
          "@type": "SoftwareApplication",
          "name": "Starlake",
          "applicationCategory": "Data Loading & Transformation Platform",
          "operatingSystem": "Cross-platform",
          "description": "Open source declarative data pipeline platform: extract, load and transform with YAML and SQL.",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        },
        {
          "@type": "SoftwareApplication",
          "name": "Quack on Demand",
          "applicationCategory": "Database Gateway",
          "operatingSystem": "Linux, macOS, Windows, Docker, Kubernetes",
          "url": "https://docs.starlake.ai/qod",
          "description": "Multi-tenant SQL gateway for DuckDB and DuckLake: authentication, SSO, role-based access control with row and column security, ADBC, JDBC and ODBC over Arrow Flight SQL, and native DuckDB ATTACH.",
          "keywords": "DuckDB, DuckLake, access control, ACL, RBAC, ADBC, Flight SQL, SSO, OAuth, OIDC, multi-tenant",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        }
      ],
```

Also update the `mainEntity.keywords` string in the same block from `"ETL, data pipeline, data transformation, data quality, data governance"` to `"ETL, data pipeline, data transformation, data quality, data governance, DuckDB, DuckLake, access control, ADBC, Flight SQL, SSO"`.

- [ ] **Step 4: Remove the debug logging in StructuredData.js**

Delete these three lines from `src/components/StructuredData.js`:

```js
  // For debugging
  console.log("Current path:", currentPath);
  console.log("Current doc:", currentDoc);
```

- [ ] **Step 5: Give the /qod landing page its own description**

In `src/pages/qod/index.tsx`, replace:

```tsx
    <Layout
      title="Multi-tenant SQL gateway for DuckDB and DuckLake: Arrow Flight SQL and native Quack"
      description={siteConfig.tagline}
    >
```

with:

```tsx
    <Layout
      title="Multi-tenant SQL gateway for DuckDB and DuckLake: Arrow Flight SQL and native Quack"
      description="Quack on Demand turns DuckDB into a governed service: authentication, SSO, per-statement access control, ADBC, JDBC and ODBC over Flight SQL, native DuckDB ATTACH, autoscaling on Docker or Kubernetes."
    >
```

Then remove the now-unused `siteConfig` line `const { siteConfig } = useDocusaurusContext();` and the `useDocusaurusContext` import if nothing else in the file uses them (grep the file: `grep -n useDocusaurusContext src/pages/qod/index.tsx`; if only the import and that one line match, delete both).

- [ ] **Step 6: Build and verify the tags land in the HTML**

Run:
```bash
cd /Users/hayssams/git/public/starlake-docs && yarn build 2>&1 | tail -3
grep -o '<meta property="og:image" content="[^"]*"' build/qod/index.html
grep -o '<meta name="description" content="[^"]*"' build/qod/index.html
grep -c '"name":"Quack on Demand"' build/qod/index.html
grep -c 'console.log' build/qod/index.html
```
Expected: SUCCESS line; og:image is `https://docs.starlake.ai/img/social-card.png`; description starts with "Quack on Demand turns DuckDB"; the count for the JSON-LD name is `1`; the console.log count is `0`.

- [ ] **Step 7: Commit**

```bash
git add docusaurus.config.js src/components/StructuredData.js src/pages/qod/index.tsx
git commit -m "seo: site metadata, OG image and JSON-LD for Quack on Demand

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The DuckDB how-to hub (seven pages plus sidebar)

**Files:**
- Create: `qod/duckdb/index.md`
- Create: `qod/duckdb/access-control.md`
- Create: `qod/duckdb/authentication.md`
- Create: `qod/duckdb/sso.md`
- Create: `qod/duckdb/adbc.md`
- Create: `qod/duckdb/flight-sql-server.md`
- Create: `qod/duckdb/multi-tenant.md`
- Modify: `sidebars-qod.js` (insert a category after Getting Started)

**Interfaces:**
- Produces doc ids `duckdb/index`, `duckdb/access-control`, `duckdb/authentication`, `duckdb/sso`, `duckdb/adbc`, `duckdb/flight-sql-server`, `duckdb/multi-tenant` and URLs `/qod/duckdb`, `/qod/duckdb/access-control`, `/qod/duckdb/authentication`, `/qod/duckdb/sso`, `/qod/duckdb/adbc`, `/qod/duckdb/flight-sql-server`, `/qod/duckdb/multi-tenant`. Tasks 4 and 5 link to these URLs.

- [ ] **Step 1: Create the directory and the hub index**

Write `qod/duckdb/index.md`:

```markdown
---
title: "DuckDB as a service: what Quack on Demand adds"
sidebar_label: Overview
slug: /duckdb
description: "DuckDB is an embedded engine with no users, no server and no grants. Quack on Demand adds authentication, SSO, access control, ADBC and Flight SQL in front of it."
keywords: [duckdb as a service, duckdb server, duckdb gateway, duckdb access control, duckdb adbc, duckdb sso, multi-tenant duckdb, ducklake]
---

DuckDB is an embedded analytical engine: it runs inside your process, trusts whoever opened it, and has no network listener, no users and no grants. Quack on Demand keeps DuckDB as the engine and adds the service layer around it, so many people and tools can query shared DuckDB and DuckLake data with identity, authorization and scale.

## What a single DuckDB does not give you

| You need | A single DuckDB | Behind Quack on Demand |
| --- | --- | --- |
| A server other machines can reach | No listener | Arrow Flight SQL on `:31338` and native Quack on `:9494` |
| Users and passwords | None | Built-in accounts, JWT, OAuth and OIDC providers |
| Single sign-on | None | Keycloak, Google, Azure AD, Cognito, Okta via OIDC, plus SCIM |
| Grants, row filters, column masks | None | Roles, table verbs, row-level policies, column masking |
| Several teams on one deployment | One file, one process | Tenants, databases and pools, isolated at the edge |
| JDBC, ODBC, ADBC drivers | Local bindings only | Standard Flight SQL drivers for BI tools and notebooks |
| More than one machine | One process | Pools of DuckDB nodes that scale out and suspend when idle |

## How to read this section

Each page below answers one question in the words people search for, shows the mechanism with one example, and links into the operator and concept pages for the full detail.

- [DuckDB access control](/qod/duckdb/access-control): roles, grants, row and column security.
- [DuckDB authentication](/qod/duckdb/authentication): passwords, tokens and OAuth for SQL clients.
- [DuckDB single sign-on](/qod/duckdb/sso): Keycloak, Google, Azure AD and Okta.
- [Connect with ADBC](/qod/duckdb/adbc): Python, Go and Power BI.
- [A Flight SQL server for DuckDB](/qod/duckdb/flight-sql-server): JDBC, ODBC and ADBC.
- [Multi-tenant DuckDB](/qod/duckdb/multi-tenant): tenants on a shared DuckLake.

Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets. Start with the [Quickstart](/qod/getting-started/quickstart), or read the [Architecture](/qod/concepts/architecture) for how the pieces fit.
```

- [ ] **Step 2: Create the access-control page**

Write `qod/duckdb/access-control.md`:

```markdown
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
```

- [ ] **Step 3: Create the authentication page**

Write `qod/duckdb/authentication.md`:

```markdown
---
title: "DuckDB authentication: passwords, tokens and OAuth for SQL clients"
sidebar_label: Authentication
description: "Give DuckDB a login. Quack on Demand authenticates every JDBC, ADBC, ODBC or native DuckDB connection with passwords, JWT bearer tokens or OAuth before any query runs."
keywords: [duckdb authentication, duckdb auth, duckdb login, duckdb password, duckdb bearer token, duckdb oauth, duckdb jwt, flight sql authentication]
---

DuckDB has no login: opening the file is the credential. Quack on Demand authenticates every connection at the edge, with a built-in password store, external JWT bearer tokens, or OAuth and OIDC providers, before a single statement is routed to a DuckDB node.

## The problem

As soon as DuckDB data is reachable over a network, you need to know who is asking. A shared file or an unauthenticated proxy gives everyone the same identity, which makes access control, auditing and per-user row filters impossible. BI tools expect a username and password or a bearer token in the connection dialog, and notebooks expect the same in a connection string.

## How Quack on Demand does it

Every connection carries a tenant and a pool, and the edge validates the credential against that tenant's configured provider. Providers can be enabled together, and the first to accept wins:

- **Database**: username and password checked with bcrypt against the built-in user table. On by default.
- **External JWT**: a bearer token signed by keys you configure.
- **Keycloak, Google, Azure AD, AWS Cognito**: OIDC bearer tokens verified against the provider's JWKS. Keycloak and Cognito also accept a username and password from JDBC tools through the resource owner password grant.

Roles and groups can be read from token claims, and the resulting session is cached for a configurable TTL. A JDBC client passes the credential in the URL; ADBC and raw Flight clients pass it as headers:

```
jdbc:arrow-flight-sql://gateway:31338?useEncryption=true&user=alice&password=demo-alice&tenant=acme&pool=bi
```

Superusers authenticate against the manager's global providers with `superuser=true` and bypass the per-statement gate. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Authentication](/qod/operating/authentication): realms, the provider chain, claims to roles, sessions.
- [Authentication providers](/qod/operating/auth-providers): enabling and configuring each provider.
- [Authenticating a client](/qod/connecting/authenticating): the client side, credentials and TLS.
- [OAuth / OIDC server setup](/qod/operating/oauth-server-setup): the identity-provider side, per provider.
- [TLS](/qod/operating/tls): certificates on the Flight SQL and native listeners.
```

- [ ] **Step 4: Create the SSO page**

Write `qod/duckdb/sso.md`:

```markdown
---
title: "DuckDB single sign-on with Keycloak, Google, Azure AD and Okta"
sidebar_label: Single sign-on
description: "Single sign-on for DuckDB: Quack on Demand accepts OIDC tokens from Keycloak, Google, Azure AD, Cognito or Okta for SQL clients and the admin UI, and syncs users with SCIM."
keywords: [duckdb sso, duckdb single sign-on, duckdb oidc, duckdb keycloak, duckdb azure ad, duckdb okta, duckdb google login, duckdb scim]
---

Single sign-on for DuckDB means a user opens Power BI, DBeaver or a notebook and authenticates with the company identity provider, not with a password stored in a file. Quack on Demand does this with OIDC bearer tokens for SQL clients, OIDC discovery for the admin UI, and SCIM to keep users and groups in sync.

## The problem

Enterprise IT will not hand out shared passwords for a data endpoint. They want the identity provider they already run, Keycloak, Google Workspace, Microsoft Entra, Okta or Cognito, to decide who can log in, to revoke access centrally, and to provision and deprovision accounts automatically. A single DuckDB has no place to plug that in.

## How Quack on Demand does it

For the SQL wire, enable one or more OIDC providers. The gateway derives the JWKS endpoint, verifies each bearer token's signature, issuer and audience, and maps the user to a tenant. Each tenant selects its own provider, so one deployment can serve a Keycloak tenant and a Google tenant side by side. Clients that can only send a username and password, such as JDBC drivers, get a token through Keycloak's or Cognito's password grant; others use the browser token page.

```bash
QOD_AUTH_KEYCLOAK_ENABLED=true
QOD_AUTH_KEYCLOAK_BASE_URL=https://keycloak.example.com
QOD_AUTH_KEYCLOAK_REALM=your-realm
QOD_AUTH_KEYCLOAK_CLIENT_ID=quack-client
QOD_AUTH_KEYCLOAK_CLIENT_SECRET=client-secret
```

For the admin UI, a separate provider-agnostic switch uses OIDC discovery: configure an issuer URL and a client id and secret, and the manager resolves the authorize, token and JWKS endpoints itself, so any compliant IdP works. Groups can be enriched from Google Workspace or read from token claims. SCIM 2.0 endpoints per tenant let Okta, Entra or Google provision and deprovision users and groups without anyone touching the gateway. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Authentication providers](/qod/operating/auth-providers): Keycloak, Google, Azure AD, Cognito, the browser token page and admin UI SSO.
- [OAuth / OIDC server setup](/qod/operating/oauth-server-setup): redirect URIs, client registration, worked Power BI via Keycloak example.
- [SCIM provisioning](/qod/operating/scim-provisioning): the endpoints and connector setup.
- [Authentication](/qod/operating/authentication): how claims become roles and groups.
```

- [ ] **Step 5: Create the ADBC page**

Write `qod/duckdb/adbc.md`:

```markdown
---
title: "Connect to DuckDB with ADBC from Python, Go and Power BI"
sidebar_label: ADBC
description: "Use ADBC to query a shared DuckDB over Arrow Flight SQL. Quack on Demand serves the standard Flight SQL ADBC driver, so Python, Go and Power BI connect with no custom client."
keywords: [duckdb adbc, adbc flight sql, adbc_driver_flightsql, duckdb python client, duckdb go client, power bi adbc, arrow database connectivity duckdb]
---

ADBC, Arrow Database Connectivity, is the Arrow-native way to talk to a database from Python, Go, C++ and Power BI. Quack on Demand exposes DuckDB behind an Arrow Flight SQL endpoint, so the standard Flight SQL ADBC driver connects to it with no DuckDB-specific client and results arrive as Arrow batches with no row conversion.

## The problem

DuckDB's own Python and Go bindings talk to an engine inside your process, not to a shared one on another machine. When the data lives on a server, you want a driver that speaks a standard wire, streams columnar results, and works the same from a notebook, a Go service and Power BI.

## How Quack on Demand does it

The gateway's Flight SQL edge on `:31338` is what the ADBC Flight SQL driver expects. The connection needs a URI, a username and password or bearer token, and two call headers naming the tenant and the pool; the edge applies no defaults. Results are Arrow record batches all the way from the DuckDB node to your DataFrame.

```python
import adbc_driver_flightsql.dbapi as flight_sql
from adbc_driver_flightsql import DatabaseOptions

hdr = DatabaseOptions.RPC_CALL_HEADER_PREFIX.value
conn = flight_sql.connect(
    uri="grpc+tls://gateway:31338",
    db_kwargs={
        "username": "alice",
        "password": "demo-alice",
        DatabaseOptions.TLS_SKIP_VERIFY.value: "true",  # self-signed cert
        hdr + "tenant": "acme",
        hdr + "pool": "bi",
    },
)
cur = conn.cursor()
cur.execute("SELECT count(*) FROM tpch1.customer")
print(cur.fetchall())
```

Power BI Desktop ships the Flight SQL ADBC driver in-box, and the Quack on Demand connector rides it for Import and DirectQuery with query folding. The Go driver takes the same URI and headers. Whatever the client, the per-statement access control, row filters and column masks apply. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Connecting clients](/qod/connecting/clients): the Flight SQL connection target and the ADBC, JDBC and raw Flight header rules.
- [Power BI](/qod/connecting/powerbi): the ADBC-based connector, Import and DirectQuery.
- [Authenticating a client](/qod/connecting/authenticating): passwords, bearer tokens and TLS on the client.
- [Supported SQL](/qod/connecting/sql): the DuckDB dialect through the gateway.
```

- [ ] **Step 6: Create the Flight SQL server page**

Write `qod/duckdb/flight-sql-server.md`:

```markdown
---
title: "A Flight SQL server for DuckDB: JDBC, ODBC and ADBC"
sidebar_label: Flight SQL server
description: "DuckDB has no server. Quack on Demand is an Arrow Flight SQL server for DuckDB and DuckLake, so JDBC, ODBC and ADBC clients such as DBeaver, Tableau and Power BI connect to it."
keywords: [duckdb flight sql, duckdb server, arrow flight sql server, duckdb jdbc, duckdb odbc, duckdb remote access, duckdb network, duckdb client server]
---

DuckDB does not ship a server: it is a library, and its bindings open a database inside your process. Quack on Demand is an Arrow Flight SQL server for DuckDB and DuckLake, which means every tool that carries a Flight SQL driver, JDBC, ODBC or ADBC, connects to shared DuckDB data the way it connects to any warehouse.

## The problem

BI tools, SQL editors and services on other machines need a network endpoint and a standard driver. Serving a DuckDB file over HTTP or a filesystem share gives you neither: each client still runs its own engine, sees a stale or locked file, and carries no identity. You want one endpoint, one identity model, and drivers your tools already have.

## How Quack on Demand does it

One command boots the manager, the Flight SQL edge on `:31338`, DuckDB's native Quack listener on `:9494` and the admin UI, then prints ready-to-paste connection strings for every driver family:

```bash
uvx qod@latest serve --demo
#   JDBC : jdbc:arrow-flight-sql://localhost:31338/?tenant=<tenant>&pool=<pool>&user=<user>&useEncryption=true&disableCertificateVerification=true
#   ADBC : uri=grpc+tls://localhost:31338  (adbc_driver_flightsql)
#   ODBC : Driver={Arrow Flight SQL ODBC Driver};Host=localhost;Port=31338;...
#   DuckDB: ATTACH 'quack:localhost:9494' AS qod (TYPE quack, TOKEN 'tenant=<tenant>&pool=<pool>&user=<user>&password=<password>');
```

The JDBC driver is the Apache Arrow Flight SQL JDBC driver from Maven Central, which DBeaver, Tableau and Spark load directly. ADBC uses the Flight SQL driver that Power BI ships in-box. ODBC uses any third-party Flight SQL ODBC driver. Behind the edge, statements are classified read or write and routed to the least-loaded DuckDB node in the pool, with transactions pinned to one node. TLS is on by default. Quack on Demand runs as a single Docker container on one node, or on Kubernetes for multi-host fleets.

## Go deeper

- [Connecting clients](/qod/connecting/clients): the connection target, JDBC, Python, Go and ODBC recipes.
- [DBeaver](/qod/connecting/dbeaver), [Tableau](/qod/connecting/tableau), [Power BI](/qod/connecting/powerbi): per-tool walkthroughs.
- [DuckDB (native Quack)](/qod/connecting/duckdb): the driverless path for DuckDB itself.
- [Routing and statement classification](/qod/concepts/routing): how a statement picks a node.
- [Quickstart](/qod/getting-started/quickstart): boot, connect, query.
```

- [ ] **Step 7: Create the multi-tenant page**

Write `qod/duckdb/multi-tenant.md`:

```markdown
---
title: "Multi-tenant DuckDB on a shared DuckLake"
sidebar_label: Multi-tenant
description: "Run many teams or customers on one DuckDB deployment. Quack on Demand isolates tenants, databases and pools of DuckDB nodes over shared DuckLake catalogs and object storage."
keywords: [multi-tenant duckdb, duckdb multi tenant, duckdb saas, tenant isolation duckdb, ducklake multi-tenant, shared duckdb, duckdb pools]
---

Multi-tenant DuckDB means several teams or customers query one deployment while each sees only its own databases, users and compute. Quack on Demand models that as tenants that own databases (DuckLake catalogs) and pools of DuckDB nodes, and enforces the boundary at the edge on every connection and statement.

## The problem

One DuckDB process serves one file for one caller. Giving each team its own file and its own machine multiplies operations and still shares nothing safely, while putting everyone on one file shares everything. What you want is one governed endpoint where a tenant is a real isolation boundary, compute scales per tenant, and idle tenants cost nothing.

## How Quack on Demand does it

Three nested objects organize the deployment. A **tenant** is the isolation boundary and selects its users' authentication provider. A **tenant-db** is a database: a DuckLake catalog in its own Postgres database with its own data path on the filesystem or an S3-compatible store. A **pool** is a set of DuckDB nodes bound to one tenant-db, and it is what clients connect to. A client names its tenant and pool at connection time; the gateway resolves the database server-side and never trusts token claims for routing.

```sql
ATTACH 'quack:qod.example.com:9494' AS qod
  (TYPE quack, TOKEN 'tenant=acme&pool=bi&user=alice&password=demo-alice');

SELECT count(*) FROM qod.tpch1.orders;
```

Pools scale from an autoscale band, suspend to zero nodes when idle and wake on the first query, so tenants pay for compute only while queries run. Usage is metered per tenant, pool and user, and the audit log and statement history are tenant-scoped. Federation lets a tenant attach Postgres, MySQL, S3 or Iceberg sources under the same access-control model. Quack on Demand runs as a single Docker container on one node, ideal for a single tenant, or on Kubernetes for multi-host fleets.

## Go deeper

- [Tenancy model](/qod/concepts/tenancy): the three levels and how isolation is enforced.
- [Tenants and databases](/qod/operating/tenants-databases): provisioning.
- [Pools and cohorts](/qod/operating/pools-cohorts) and [Autoscaling pools](/qod/operating/autoscaling): compute per tenant.
- [Onboard a tenant](/qod/administration/onboarding): the golden path from sign-in to a working connection string.
- [Usage and accounting](/qod/administration/usage-accounting): metering for chargeback.
```

- [ ] **Step 8: Add the sidebar category**

In `sidebars-qod.js`, directly after the `Getting Started` category object (the one whose items are `['getting-started/quickstart', 'getting-started/install', 'getting-started/demo']`), insert:

```js
    {
      type: 'category',
      label: 'DuckDB how-tos',
      link: { type: 'doc', id: 'duckdb/index' },
      items: [
        'duckdb/access-control',
        'duckdb/authentication',
        'duckdb/sso',
        'duckdb/adbc',
        'duckdb/flight-sql-server',
        'duckdb/multi-tenant',
      ],
    },
```

- [ ] **Step 9: Build, check the URLs and the sitemap**

Run:
```bash
cd /Users/hayssams/git/public/starlake-docs && yarn build 2>&1 | tail -3
for p in duckdb duckdb/access-control duckdb/authentication duckdb/sso duckdb/adbc duckdb/flight-sql-server duckdb/multi-tenant; do test -f build/qod/$p/index.html && echo "ok $p" || echo "MISSING $p"; done
grep -c 'docs.starlake.ai/qod/duckdb' build/sitemap.xml
for f in qod/duckdb/*.md; do printf '%s %s words\n' "$f" "$(awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2' $f | wc -w)"; done
```
Expected: SUCCESS; seven `ok` lines; sitemap count `7`; every page between 250 and 400 words (the index may run slightly over because of the table; that is acceptable).

- [ ] **Step 10: Commit**

```bash
git add qod/duckdb sidebars-qod.js
git commit -m "docs(qod): DuckDB how-to hub targeting access control, auth, SSO, ADBC, Flight SQL, multi-tenant

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Descriptions, keywords and sharper titles on every existing QoD page

**Files:**
- Modify: every `.md` and `.mdx` file under `qod/` except `qod/duckdb/` (63 files, frontmatter only)
- Create (temporary, in the scratchpad, not committed): `apply-frontmatter.js`

**Interfaces:**
- Consumes nothing from earlier tasks.
- Produces `description` and `keywords` frontmatter on all 63 pages; `title` plus `sidebar_label` on the 18 pages listed with a `newTitle`.

- [ ] **Step 1: Write the mapping and the applier script**

Write `/private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/0b882950-2f33-42cd-a052-4dade1832fc3/scratchpad/apply-frontmatter.js` (run it from the repo root). Each entry: `desc` (120 to 160 chars), `kw` (array), optional `newTitle` (then `sidebar_label` becomes the old title unless the file already has one).

```js
const fs = require("fs");
const path = require("path");

const M = {
  "qod/administration/access-control.md": {
    newTitle: "Grant and revoke access to DuckDB tables",
    desc: "Grant a team read access to DuckDB tables, add row filters and column masks, and revoke access, from the admin UI, the qod CLI, or plain SQL.",
    kw: ["duckdb access control", "duckdb acl", "grant", "revoke", "row-level security", "column masking", "rbac"],
  },
  "qod/administration/audit-log.md": {
    desc: "How Quack on Demand records a tenant-scoped audit trail of admin actions, auth events, denials and data-plane writes on DuckDB.",
    kw: ["audit log", "duckdb audit trail", "compliance", "telemetry"],
  },
  "qod/administration/day-2-operations.md": {
    desc: "Operational playbooks for a running DuckDB fleet: watch the Nodes board, scale pools, drain before maintenance, inspect recent statements.",
    kw: ["duckdb operations", "scaling", "nodes board", "drain pool", "qod cli"],
  },
  "qod/administration/index.md": {
    desc: "Superuser and tenant admin roles in Quack on Demand, and where each administrative task on your DuckDB gateway lives in the UI and CLI.",
    kw: ["duckdb administration", "superuser", "tenant admin", "control plane"],
  },
  "qod/administration/lifecycle-config.md": {
    desc: "Attach external catalogs, rotate secrets, back up and restore configuration, and decommission a DuckDB gateway cleanly, step by step.",
    kw: ["lifecycle", "rotate secrets", "backup", "restore", "external catalog", "decommission"],
  },
  "qod/administration/manage-by-manifest.md": {
    desc: "Manage every tenant, pool, role, user and grant of your DuckDB gateway as one version-controlled YAML manifest: export, edit, re-import.",
    kw: ["manifest", "yaml", "gitops", "configuration as code", "duckdb gateway"],
  },
  "qod/administration/onboarding.md": {
    desc: "Golden path for onboarding a tenant: sign in, create the database and pool, add users, hand a BI user a DuckDB connection string.",
    kw: ["onboarding", "tenant", "duckdb connection string", "admin console", "qod cli"],
  },
  "qod/administration/sql-administration.md": {
    newTitle: "Administer DuckDB access with SQL: roles, grants, row and column policies",
    desc: "Manage users, roles, grants, row policies and column masks on DuckDB with plain SQL from any client: CREATE ROLE, GRANT, CREATE ROW POLICY.",
    kw: ["duckdb grant", "duckdb create role", "row policy", "column policy", "sql administration", "duckdb acl"],
  },
  "qod/administration/usage-accounting.md": {
    desc: "Per-tenant, per-pool and per-user metering of DuckDB statements, a durable ledger for chargeback, billing exports and capacity planning.",
    kw: ["usage", "metering", "chargeback", "billing", "duckdb usage accounting"],
  },
  "qod/cli/admin.md": {
    desc: "Provision a tenant end to end with the qod CLI: login, database, pool, users, roles, grants, and a query under row-level security on DuckDB.",
    kw: ["qod cli", "duckdb administration", "provisioning", "row-level security"],
  },
  "qod/cli/index.md": {
    desc: "The qod command-line client for Quack on Demand: boot a DuckDB gateway, administer tenants and access control, and run Flight SQL queries.",
    kw: ["qod cli", "duckdb cli", "flight sql client", "command line"],
  },
  "qod/cli/reference.md": {
    desc: "Every qod CLI command by noun and verb, with flags, profiles and JSON output for scripting a DuckDB gateway from CI or a shell.",
    kw: ["qod cli reference", "commands", "flags"],
  },
  "qod/cli/sql.md": {
    desc: "Run one-shot or interactive SQL against a DuckDB gateway with qod sql, the Arrow Flight SQL client built into the command-line tool.",
    kw: ["qod sql", "duckdb repl", "flight sql cli", "interactive sql"],
  },
  "qod/concepts/architecture.md": {
    newTitle: "Architecture of a multi-tenant DuckDB gateway",
    desc: "How Quack on Demand puts an authenticated, access-controlled, horizontally scaled SQL surface in front of DuckDB: planes, object model, request flow.",
    kw: ["duckdb architecture", "duckdb gateway", "control plane", "data plane", "flight sql", "ducklake"],
  },
  "qod/concepts/catalogs.md": {
    desc: "The three database kinds behind a Quack on Demand database, how a DuckLake catalog separates metadata from Parquet data, and the data path.",
    kw: ["ducklake catalog", "duckdb catalog", "parquet", "metadata", "data path"],
  },
  "qod/concepts/routing.md": {
    desc: "How each statement on the Flight SQL edge is classified read or write and routed to the least-loaded DuckDB node, with cache-aware placement.",
    kw: ["duckdb routing", "load balancing", "statement classification", "read write split"],
  },
  "qod/concepts/sessions-transactions.md": {
    desc: "The session model of the DuckDB gateway: how transactions pin to a node, when a pin is invalidated, and how prepared statements behave.",
    kw: ["duckdb transactions", "sessions", "prepared statements", "transaction pinning"],
  },
  "qod/concepts/state-storage.md": {
    desc: "Where Quack on Demand keeps control-plane state (tenants, pools, RBAC graph) in Postgres, separate from tenant data in DuckLake catalogs.",
    kw: ["state storage", "postgres", "control plane", "metastore"],
  },
  "qod/concepts/tenancy.md": {
    newTitle: "Multi-tenant DuckDB: the tenancy model",
    desc: "How Quack on Demand isolates tenants on shared DuckDB infrastructure: tenants, databases and pools, and what enforces the boundary between them.",
    kw: ["multi-tenant duckdb", "tenant isolation", "tenancy", "ducklake"],
  },
  "qod/connecting/agent-skill.md": {
    desc: "Install the Quack on Demand agent skill so Claude Code, Copilot or Gemini CLI can operate your DuckDB gateway through the qod CLI.",
    kw: ["agent skill", "claude code", "ai agents", "duckdb automation"],
  },
  "qod/connecting/authenticating.md": {
    newTitle: "Authenticating a client to DuckDB over Flight SQL",
    desc: "How a Flight SQL client authenticates to the DuckDB gateway: password or bearer token, how the tenant is resolved, and the TLS settings to use.",
    kw: ["duckdb authentication", "flight sql auth", "bearer token", "password", "tls"],
  },
  "qod/connecting/clients.md": {
    newTitle: "Connecting clients to DuckDB: JDBC, ADBC, ODBC and native ATTACH",
    desc: "Connect JDBC, ADBC, ODBC, Python and DuckDB itself to a governed DuckDB gateway: connection targets, credentials and per-client recipes.",
    kw: ["duckdb jdbc", "duckdb adbc", "duckdb odbc", "flight sql", "connect to duckdb", "python duckdb client"],
  },
  "qod/connecting/dbeaver.md": {
    newTitle: "DBeaver to DuckDB over Flight SQL JDBC",
    desc: "Connect DBeaver to a shared DuckDB through the Arrow Flight SQL JDBC driver: register the driver, build the URL, pass an OAuth token.",
    kw: ["dbeaver duckdb", "flight sql jdbc", "dbeaver arrow flight"],
  },
  "qod/connecting/duckdb.md": {
    desc: "ATTACH a governed DuckDB gateway from any DuckDB client with the quack extension, no driver required, and join remote tables with local ones.",
    kw: ["duckdb attach", "quack protocol", "duckdb client server", "duckdb remote"],
  },
  "qod/connecting/mcp.md": {
    newTitle: "MCP server: AI agents querying DuckDB under RBAC",
    desc: "Let Claude Code, Claude Desktop or Cursor query DuckDB through the embedded MCP server, with the same RBAC, row and column policies as any SQL client.",
    kw: ["duckdb mcp", "mcp server", "ai agents", "claude", "cursor", "rbac"],
  },
  "qod/connecting/powerbi.md": {
    newTitle: "Power BI to DuckDB with the ADBC connector",
    desc: "Connect Power BI and Microsoft Fabric to DuckDB with the QoD connector on the in-box Flight SQL ADBC driver: Import, DirectQuery and query folding.",
    kw: ["power bi duckdb", "adbc power bi", "directquery duckdb", "microsoft fabric", "flight sql adbc"],
  },
  "qod/connecting/sql.md": {
    newTitle: "Supported SQL: the DuckDB dialect through the gateway",
    desc: "What SQL you can run through the DuckDB gateway: the DuckDB dialect, default schema rules, transactions, prepared statements and ACL rewrites.",
    kw: ["duckdb sql", "supported sql", "transactions", "prepared statements"],
  },
  "qod/connecting/tableau.md": {
    newTitle: "Tableau to DuckDB over Flight SQL JDBC",
    desc: "Connect Tableau Desktop to a shared DuckDB through the generic JDBC connector and the Arrow Flight SQL JDBC driver, with no custom connector.",
    kw: ["tableau duckdb", "flight sql jdbc", "tableau jdbc"],
  },
  "qod/contributing/architecture-map.md": {
    desc: "Codebase orientation for contributors to Quack on Demand: process model, request flow, and where each concern lives in the source tree.",
    kw: ["contributing", "architecture map", "codebase"],
  },
  "qod/contributing/dev-loop.md": {
    desc: "Day-to-day developer workflow for Quack on Demand: build, test, run locally and regenerate the documentation from the source tree.",
    kw: ["contributing", "build", "test", "development"],
  },
  "qod/contributing/extending.md": {
    desc: "Extend Quack on Demand with a new runtime backend or a new authentication provider through the two seams designed for it.",
    kw: ["extending", "runtime backend", "authentication provider", "plugin"],
  },
  "qod/getting-started/demo.md": {
    desc: "Turn a fresh install into a multi-tenant DuckDB demo with TPC-H, TPC-DS or SSB data, a full RBAC graph and a federated catalog in one command.",
    kw: ["duckdb demo", "tpch", "tpcds", "multi-tenant demo", "rbac"],
  },
  "qod/getting-started/install.md": {
    desc: "Install Quack on Demand as a Docker image or a single jar driven by the qod CLI, from uvx demo mode to a durable DuckDB gateway.",
    kw: ["install", "docker", "uvx", "pip install qod", "duckdb gateway"],
  },
  "qod/getting-started/quickstart.md": {
    newTitle: "Quickstart: a governed DuckDB gateway in one command",
    desc: "Boot a multi-tenant DuckDB gateway, connect a client over Flight SQL or native ATTACH, and run your first query on TPC-H data.",
    kw: ["duckdb quickstart", "duckdb server", "flight sql", "ducklake", "getting started"],
  },
  "qod/introduction.mdx": {
    newTitle: "Quack on Demand: multi-tenant SQL gateway for DuckDB and DuckLake",
    desc: "Quack on Demand puts an authenticated, access-controlled, autoscaled SQL endpoint in front of DuckDB and DuckLake, over Flight SQL or native ATTACH.",
    kw: ["duckdb gateway", "duckdb server", "multi-tenant duckdb", "duckdb access control", "ducklake", "flight sql", "adbc"],
  },
  "qod/operating/admin-ui.md": {
    desc: "Tour of the Quack on Demand admin console: tenants, databases, pools, users, access control, and live node and statement telemetry.",
    kw: ["admin ui", "console", "duckdb administration"],
  },
  "qod/operating/auth-providers.md": {
    newTitle: "Authentication providers for DuckDB clients: database, JWT, Keycloak, Google, Azure AD, Cognito",
    desc: "Enable and configure each authentication provider for DuckDB clients: built-in passwords, external JWT, Keycloak, Google, Azure AD, Cognito, UI SSO.",
    kw: ["duckdb sso", "duckdb oauth", "keycloak", "azure ad", "google", "cognito", "oidc", "jwt"],
  },
  "qod/operating/authentication.md": {
    newTitle: "Authentication: how DuckDB clients prove who they are",
    desc: "How the Flight SQL edge authenticates every DuckDB client: the provider chain, credentials, roles and groups from tokens, and session caching.",
    kw: ["duckdb authentication", "auth chain", "bearer token", "session", "roles from claims"],
  },
  "qod/operating/autoscaling.md": {
    desc: "Declare an autoscale band and let the manager add and remove DuckDB read nodes with load, without anyone scaling the pool by hand.",
    kw: ["duckdb autoscaling", "autoscale", "pools", "elastic"],
  },
  "qod/operating/branching.md": {
    desc: "Zero-copy branches of a DuckLake database: agents and pipelines write on a branch, humans review the row-level diff and merge into main.",
    kw: ["ducklake branching", "zero-copy branch", "data branching", "agents"],
  },
  "qod/operating/deploy-docker.md": {
    desc: "Run the whole DuckDB gateway as a Docker Compose stack: manager, Postgres metastore and DuckDB nodes in one container on one host.",
    kw: ["duckdb docker", "docker compose", "single node", "deployment"],
  },
  "qod/operating/deploy-kubernetes.md": {
    desc: "Deploy Quack on Demand on Kubernetes: the manager as a pod that spawns DuckDB node pods on demand, per pool, with highly available managers.",
    kw: ["duckdb kubernetes", "k8s", "helm", "deployment", "pods"],
  },
  "qod/operating/deploy-local.md": {
    desc: "The default local runtime: DuckDB nodes as child processes of the manager on one machine, for development, evaluation and small deployments.",
    kw: ["local deployment", "development", "runtime"],
  },
  "qod/operating/deploy-single-server.md": {
    desc: "Production deployment of a DuckDB gateway on one large server with an existing PostgreSQL and an S3-compatible object store such as MinIO.",
    kw: ["single server", "production", "postgresql", "s3", "minio", "duckdb deployment"],
  },
  "qod/operating/encryption.md": {
    newTitle: "Encryption at rest for DuckDB and DuckLake databases",
    desc: "Create a database with its DuckDB or DuckLake data encrypted on disk with one switch at create time, and how the mechanism differs by kind.",
    kw: ["duckdb encryption", "encryption at rest", "ducklake encryption"],
  },
  "qod/operating/federation.md": {
    desc: "Attach Postgres, MySQL, S3 or Iceberg catalogs to a DuckDB gateway database and query them under the same access-control model as native tables.",
    kw: ["duckdb federation", "federated query", "iceberg", "postgres", "attach catalog"],
  },
  "qod/operating/hardening.md": {
    desc: "Security hardening checklist for exposing a DuckDB gateway to untrusted users: defaults to change, secrets, network and the SQL surface.",
    kw: ["duckdb security", "hardening", "production security"],
  },
  "qod/operating/history-trends.md": {
    desc: "Every Flight SQL statement recorded for recent search and rolled up into trend charts: latency, routing and volume per tenant and pool.",
    kw: ["statement history", "query history", "trends", "duckdb monitoring"],
  },
  "qod/operating/maintenance.md": {
    desc: "Managed DuckLake maintenance: compaction, snapshot expiry and file cleanup per database, on compute isolated from query serving.",
    kw: ["ducklake maintenance", "compaction", "snapshot expiry", "storage"],
  },
  "qod/operating/managed-storage.md": {
    desc: "Managed object storage: configure one root bucket and let every DuckLake database get its own prefix and credentials automatically.",
    kw: ["managed storage", "object store", "s3", "ducklake storage"],
  },
  "qod/operating/manifest.md": {
    desc: "Export the entire control-plane configuration as one YAML manifest and import it to restore, clone an environment or apply a reviewed change.",
    kw: ["manifest", "backup", "restore", "yaml", "configuration"],
  },
  "qod/operating/oauth-server-setup.md": {
    newTitle: "OAuth / OIDC for DuckDB clients: Keycloak, Google, Azure AD and Cognito server setup",
    desc: "Server-side reference for bearer-token authentication of JDBC, ADBC and ODBC clients to DuckDB with Keycloak, Google, Azure AD or AWS Cognito.",
    kw: ["duckdb oauth", "duckdb oidc", "keycloak", "azure ad", "cognito", "bearer token", "jdbc oauth"],
  },
  "qod/operating/observability.md": {
    desc: "Metrics for a DuckDB gateway through Micrometer: Prometheus, AWS, Azure or GCP sinks, plus a ready-made Grafana operator dashboard.",
    kw: ["duckdb metrics", "prometheus", "grafana", "observability"],
  },
  "qod/operating/pools-cohorts.md": {
    desc: "Create, size, scale and stop pools of DuckDB nodes, the node roles that drive routing, and cohort-based node placement on Kubernetes.",
    kw: ["duckdb pools", "scaling", "cohorts", "node placement"],
  },
  "qod/operating/rbac-admin.md": {
    desc: "Recipes for managing users, roles, groups, memberships and pool grants on a DuckDB gateway with the qod command-line tool.",
    kw: ["rbac", "duckdb users", "roles", "groups", "pool grants", "qod cli"],
  },
  "qod/operating/rbac-model.md": {
    newTitle: "Access control model: RBAC, row and column security for DuckDB",
    desc: "The role-based access control model enforced on every DuckDB statement: roles, groups, table verbs, row-level policies, column masking, two gates.",
    kw: ["duckdb rbac", "duckdb access control", "row-level security", "column masking", "duckdb acl", "permissions"],
  },
  "qod/operating/resilience.md": {
    desc: "What happens when a DuckDB node, the manager or Postgres fails: the topology, recovery behaviour, and the known gaps with their issue numbers.",
    kw: ["resilience", "high availability", "failover", "recovery"],
  },
  "qod/operating/scim-provisioning.md": {
    newTitle: "SCIM provisioning: sync DuckDB users and groups from Okta, Entra or Google",
    desc: "SCIM 2.0 endpoints so Okta, Microsoft Entra or Google Workspace provision and deprovision DuckDB gateway users and groups automatically.",
    kw: ["scim", "duckdb scim", "okta", "entra", "user provisioning", "sso"],
  },
  "qod/operating/tenants-databases.md": {
    desc: "Provision tenants and their databases on a DuckDB gateway, the object hierarchy behind them, and per-database object store credentials.",
    kw: ["tenants", "databases", "provisioning", "multi-tenant duckdb"],
  },
  "qod/operating/tls.md": {
    desc: "TLS on the Flight SQL edge and the native Quack listener: the default self-signed certificate, a CA-signed replacement, and client settings.",
    kw: ["duckdb tls", "flight sql tls", "certificate", "encryption in transit"],
  },
  "qod/reference/cli.md": {
    desc: "The manager uber-jar of Quack on Demand: boot the manager, run the self-contained demo, and the manifest subcommands for scripting.",
    kw: ["manager jar", "demo", "manifest"],
  },
  "qod/reference/configuration.md": {
    desc: "Every configuration key of Quack on Demand with its QOD_ environment-variable override, its default, and the sensitive values to rotate.",
    kw: ["configuration reference", "environment variables", "QOD_"],
  },
  "qod/reference/metrics.md": {
    desc: "Every metric series emitted by the DuckDB gateway, with its labels, for the Prometheus endpoint and the AWS, Azure and GCP sinks.",
    kw: ["metrics reference", "prometheus", "series"],
  },
};

const yq = (s) => JSON.stringify(s); // YAML accepts JSON-style double-quoted scalars
let touched = 0;
for (const [rel, m] of Object.entries(M)) {
  if (m.desc.length < 120 || m.desc.length > 160) {
    throw new Error(`${rel}: description is ${m.desc.length} chars`);
  }
  const file = path.resolve(rel);
  const src = fs.readFileSync(file, "utf8");
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${rel}: no frontmatter`);
  let lines = fm[1].split("\n").filter((l) => !/^(description|keywords):/.test(l));
  const titleIdx = lines.findIndex((l) => /^title:/.test(l));
  if (m.newTitle) {
    const oldTitle = lines[titleIdx].replace(/^title:\s*/, "").replace(/^["']|["']$/g, "");
    lines[titleIdx] = `title: ${yq(m.newTitle)}`;
    if (!lines.some((l) => /^sidebar_label:/.test(l))) {
      lines.splice(titleIdx + 1, 0, `sidebar_label: ${yq(oldTitle)}`);
    }
  }
  lines.push(`description: ${yq(m.desc)}`);
  lines.push(`keywords: [${m.kw.map(yq).join(", ")}]`);
  fs.writeFileSync(file, `---\n${lines.join("\n")}\n---\n` + src.slice(fm[0].length));
  touched++;
}
console.log(`updated ${touched} files`);
```

- [ ] **Step 2: Run the script**

Run: `cd /Users/hayssams/git/public/starlake-docs && node /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/0b882950-2f33-42cd-a052-4dade1832fc3/scratchpad/apply-frontmatter.js`
Expected: `updated 63 files`. If it throws on a description length, shorten or lengthen that entry and re-run (the script is idempotent: it strips existing description and keywords lines before adding).

- [ ] **Step 3: Verify coverage and titles**

Run:
```bash
cd /Users/hayssams/git/public/starlake-docs
echo "pages: $(find qod -path qod/duckdb -prune -o \( -name '*.md' -o -name '*.mdx' \) -print | wc -l)"
echo "with description: $(grep -l '^description:' $(find qod -path qod/duckdb -prune -o \( -name '*.md' -o -name '*.mdx' \) -print) | wc -l)"
echo "with keywords: $(grep -l '^keywords:' $(find qod -path qod/duckdb -prune -o \( -name '*.md' -o -name '*.mdx' \) -print) | wc -l)"
echo "sidebar_label added: $(grep -l '^sidebar_label:' qod -r | wc -l)"
head -8 qod/operating/rbac-model.md
git diff --stat | tail -1
```
Expected: pages 63, with description 63, with keywords 63, sidebar_label at least 20 (18 new plus the 2 that existed, plus the 7 hub pages). The rbac-model frontmatter shows the new title, `sidebar_label: "Access control model"`, description and keywords. Diff stat shows 63 files changed.

- [ ] **Step 4: Build and verify meta tags in the output**

Run:
```bash
cd /Users/hayssams/git/public/starlake-docs && yarn build 2>&1 | tail -3
echo "qod pages without a description tag:"; for f in $(find build/qod -name index.html); do grep -q '<meta name="description"' $f || echo $f; done
grep -o '<meta name="keywords" content="[^"]*"' build/qod/operating/rbac-model/index.html
grep -o '<title>[^<]*</title>' build/qod/operating/rbac-model/index.html
```
Expected: SUCCESS; no files listed (every QoD page has a description); the keywords meta on rbac-model contains `duckdb rbac`; the title contains `RBAC, row and column security for DuckDB`.

- [ ] **Step 5: Commit**

```bash
git add qod
git commit -m "docs(qod): description, keywords and DuckDB-aware titles on every page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: llms.txt routes and Quack on Demand section

**Files:**
- Modify: `static/llms.txt`

**Interfaces:**
- Consumes the hub URLs from Task 2.

- [ ] **Step 1: Rewrite the stale root routes**

Run from the repo root:
```bash
sed -i '' -E 's#https://docs\.starlake\.ai/(guides|cli|setup|category|configuration|comparisons|glossary)([/)])#https://docs.starlake.ai/starflow/\1\2#g' static/llms.txt
sed -i '' 's#\[Overview\](https://docs.starlake.ai/)#[Overview](https://docs.starlake.ai/starflow/overview)#' static/llms.txt
grep -c 'docs.starlake.ai/starflow/' static/llms.txt
grep -E 'docs\.starlake\.ai/(guides|cli|setup|category|configuration|comparisons|glossary)' static/llms.txt | wc -l
```
Expected: first count around `92` (every link), second count `0`.

- [ ] **Step 2: Extend the intro and add the Quack on Demand section**

Replace the intro paragraph's last sentence `Supports BigQuery, Snowflake, Databricks, Spark, PostgreSQL, and DuckDB.` with:

```
Supports BigQuery, Snowflake, Databricks, Spark, PostgreSQL, and DuckDB. The same site documents Quack on Demand, a multi-tenant SQL gateway that turns DuckDB and DuckLake into a governed service with authentication, single sign-on, role-based access control with row and column security, and ADBC, JDBC and ODBC access over Arrow Flight SQL.
```

Then insert this block immediately before the line `## Overview`:

```
## Quack on Demand (DuckDB gateway)

- [DuckDB as a service](https://docs.starlake.ai/qod/duckdb): What a single DuckDB lacks (server, users, grants, tenants) and what Quack on Demand adds
- [DuckDB access control](https://docs.starlake.ai/qod/duckdb/access-control): Roles, table grants, row-level security and column masking enforced on every DuckDB statement
- [DuckDB authentication](https://docs.starlake.ai/qod/duckdb/authentication): Passwords, JWT bearer tokens and OAuth for JDBC, ADBC, ODBC and native DuckDB clients
- [DuckDB single sign-on](https://docs.starlake.ai/qod/duckdb/sso): OIDC SSO with Keycloak, Google, Azure AD, Cognito or Okta, plus SCIM provisioning
- [DuckDB with ADBC](https://docs.starlake.ai/qod/duckdb/adbc): Connect from Python, Go and Power BI with the Flight SQL ADBC driver
- [Flight SQL server for DuckDB](https://docs.starlake.ai/qod/duckdb/flight-sql-server): JDBC, ODBC and ADBC drivers against shared DuckDB data
- [Multi-tenant DuckDB](https://docs.starlake.ai/qod/duckdb/multi-tenant): Tenants, databases and pools of DuckDB nodes over a shared DuckLake
- [Introduction](https://docs.starlake.ai/qod/introduction): What Quack on Demand is, when to use it, and when plain DuckDB is enough
- [Quickstart](https://docs.starlake.ai/qod/getting-started/quickstart): Boot the gateway with uvx, connect a client, run a query on TPC-H data
- [Installation](https://docs.starlake.ai/qod/getting-started/install): Docker image or single jar driven by the qod CLI
- [Architecture](https://docs.starlake.ai/qod/concepts/architecture): Control plane, data plane, object model and request lifecycle
- [Tenancy model](https://docs.starlake.ai/qod/concepts/tenancy): Tenants, tenant databases, pools and how isolation is enforced
- [Routing](https://docs.starlake.ai/qod/concepts/routing): Statement classification and least-loaded node selection
- [DuckLake catalogs](https://docs.starlake.ai/qod/concepts/catalogs): The three database kinds and how DuckLake separates metadata from Parquet data
- [Connecting clients](https://docs.starlake.ai/qod/connecting/clients): Connection target and recipes for JDBC, ADBC, ODBC, Python and Go
- [DuckDB native ATTACH](https://docs.starlake.ai/qod/connecting/duckdb): Attach the gateway from any DuckDB with the quack extension, no driver
- [Power BI](https://docs.starlake.ai/qod/connecting/powerbi): ADBC-based connector with Import, DirectQuery and query folding
- [Tableau](https://docs.starlake.ai/qod/connecting/tableau): Generic JDBC connector with the Flight SQL JDBC driver
- [DBeaver](https://docs.starlake.ai/qod/connecting/dbeaver): Flight SQL JDBC driver setup and OAuth token property
- [MCP server](https://docs.starlake.ai/qod/connecting/mcp): AI agents query DuckDB under the same RBAC, row and column policies
- [Supported SQL](https://docs.starlake.ai/qod/connecting/sql): DuckDB dialect, default schema, transactions, prepared statements
- [Access control model](https://docs.starlake.ai/qod/operating/rbac-model): Entities, effective permissions, the two gates, row and column policies
- [Grant and revoke access](https://docs.starlake.ai/qod/administration/access-control): Playbooks for grants, row filters and column masks
- [Administer with SQL](https://docs.starlake.ai/qod/administration/sql-administration): CREATE ROLE, GRANT, ROW POLICY, COLUMN POLICY, CREATE USER from any client
- [Authentication](https://docs.starlake.ai/qod/operating/authentication): Provider chain, realms, claims to roles, session caching
- [Authentication providers](https://docs.starlake.ai/qod/operating/auth-providers): Database, external JWT, Keycloak, Google, Azure AD, Cognito, admin UI SSO
- [OAuth / OIDC server setup](https://docs.starlake.ai/qod/operating/oauth-server-setup): Identity-provider side configuration per provider
- [SCIM provisioning](https://docs.starlake.ai/qod/operating/scim-provisioning): Automatic user and group sync from Okta, Entra or Google
- [TLS](https://docs.starlake.ai/qod/operating/tls): Certificates on the Flight SQL edge and native listener
- [Encryption at rest](https://docs.starlake.ai/qod/operating/encryption): Encrypted DuckDB and DuckLake databases
- [Docker deployment](https://docs.starlake.ai/qod/operating/deploy-docker): Single container on one node with Postgres metastore
- [Kubernetes deployment](https://docs.starlake.ai/qod/operating/deploy-kubernetes): Manager pod spawning DuckDB node pods per pool
- [Pools and cohorts](https://docs.starlake.ai/qod/operating/pools-cohorts): Sizing, scaling and placing DuckDB nodes
- [Autoscaling](https://docs.starlake.ai/qod/operating/autoscaling): Autoscale bands that add and remove read nodes with load
- [Federation](https://docs.starlake.ai/qod/operating/federation): Attach Postgres, MySQL, S3 and Iceberg under the same ACL
- [Audit log](https://docs.starlake.ai/qod/administration/audit-log): Tenant-scoped trail of admin actions, auth events and denials
- [qod CLI](https://docs.starlake.ai/qod/cli/): Command-line client for the admin API and Flight SQL queries
- [REST API reference](https://docs.starlake.ai/api/): OpenAPI reference for the manager
```

- [ ] **Step 3: Verify**

Run:
```bash
cd /Users/hayssams/git/public/starlake-docs
grep -c 'docs.starlake.ai/qod/' static/llms.txt
grep -n 'Quack on Demand' static/llms.txt | head -3
```
Expected: qod link count `38`; the intro sentence and the section heading both match.

- [ ] **Step 4: Commit**

```bash
git add static/llms.txt
git commit -m "seo: fix llms.txt routes and add the Quack on Demand section

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Internal links from the introduction, the landing page and the blog

**Files:**
- Modify: `qod/introduction.mdx` (insert a section before `## Where to go next`)
- Modify: `src/pages/qod/index.tsx` (Closing component body)
- Modify: `blog/2026-09-05-duckdb-flight-sql-clients.mdx` (append after the final `</ul>`)
- Modify: `blog/2026-09-20-wp-duckdb-file.md` (append after the final list)

**Interfaces:**
- Consumes the hub URLs from Task 2.

- [ ] **Step 1: Introduction**

In `qod/introduction.mdx`, insert this block immediately before the line `## Where to go next`:

```markdown
## Looking for something specific?

The [DuckDB how-tos](/qod/duckdb) answer the questions people arrive with, one page each: [access control](/qod/duckdb/access-control), [authentication](/qod/duckdb/authentication), [single sign-on](/qod/duckdb/sso), [ADBC](/qod/duckdb/adbc), [a Flight SQL server](/qod/duckdb/flight-sql-server) and [multi-tenancy](/qod/duckdb/multi-tenant).

```

- [ ] **Step 2: Landing page**

In `src/pages/qod/index.tsx`, in the `Closing` component, replace:

```tsx
          <p className={styles.closingBody}>
            Many users on shared DuckDB/DuckLake data, access control on every query,
            horizontal scale, tenant isolation, or federation. Querying one local file?
            Use DuckDB directly.
          </p>
```

with:

```tsx
          <p className={styles.closingBody}>
            Many users on shared DuckDB/DuckLake data, access control on every query,
            horizontal scale, tenant isolation, or federation. Querying one local file?
            Use DuckDB directly.
          </p>
          <p className={styles.closingBody}>
            Looking for one answer? The <Link to="/qod/duckdb">DuckDB how-tos</Link> cover{' '}
            <Link to="/qod/duckdb/access-control">access control</Link>,{' '}
            <Link to="/qod/duckdb/sso">single sign-on</Link>,{' '}
            <Link to="/qod/duckdb/adbc">ADBC</Link> and{' '}
            <Link to="/qod/duckdb/multi-tenant">multi-tenancy</Link>.
          </p>
```

- [ ] **Step 3: Blog posts**

Append to the end of `blog/2026-09-05-duckdb-flight-sql-clients.mdx` (after the closing `</ul>`):

```html

<p><strong>See also:</strong> <a href="https://docs.starlake.ai/qod/duckdb/flight-sql-server">A Flight SQL server for DuckDB</a>, <a href="https://docs.starlake.ai/qod/duckdb/adbc">Connect to DuckDB with ADBC</a>, and <a href="https://docs.starlake.ai/qod/duckdb/authentication">DuckDB authentication</a> in the Quack on Demand documentation.</p>
```

Append to the end of `blog/2026-09-20-wp-duckdb-file.md`:

```markdown

**See also:** [DuckDB access control](https://docs.starlake.ai/qod/duckdb/access-control), [Multi-tenant DuckDB](https://docs.starlake.ai/qod/duckdb/multi-tenant) and [A Flight SQL server for DuckDB](https://docs.starlake.ai/qod/duckdb/flight-sql-server) in the Quack on Demand documentation.
```

- [ ] **Step 4: Build both sites and verify links**

Run:
```bash
cd /Users/hayssams/git/public/starlake-docs && yarn build 2>&1 | tail -3
grep -c 'href="/qod/duckdb' build/qod/introduction/index.html
grep -c 'href="/qod/duckdb' build/qod/index.html
IS_BLOG=true yarn build 2>&1 | tail -3
grep -c 'docs.starlake.ai/qod/duckdb' build/duckdb-flight-sql-client-families/index.html
grep -c 'docs.starlake.ai/qod/duckdb' build/duckdb-file-sharing-embedded-vs-served/index.html
yarn build 2>&1 | tail -1
```
Expected: docs build SUCCESS; introduction count at least `7`; landing count at least `5`; blog build SUCCESS; each blog page count at least `3`; final docs rebuild SUCCESS so `build/` holds the docs site again.

- [ ] **Step 5: Commit**

```bash
git add qod/introduction.mdx src/pages/qod/index.tsx blog/2026-09-05-duckdb-flight-sql-clients.mdx blog/2026-09-20-wp-duckdb-file.md
git commit -m "docs: link the DuckDB how-to hub from the intro, landing page and blog

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Final verification pass

**Files:** none modified.

- [ ] **Step 1: Full checks from the spec**

Run:
```bash
cd /Users/hayssams/git/public/starlake-docs && yarn build 2>&1 | grep -E 'SUCCESS|ERROR|broken' | head
echo "qod pages without description:"; for f in $(find build/qod -name index.html); do grep -q '<meta name="description"' $f || echo $f; done
grep -c 'og:image' build/qod/index.html
grep -c 'docs.starlake.ai/qod/duckdb' build/sitemap.xml
grep -cE 'docs\.starlake\.ai/(guides|cli|setup|category|configuration|comparisons|glossary)' build/llms.txt
grep -rl $'\xe2\x80\x94' qod/duckdb static/llms.txt docusaurus.config.js src/pages/qod/index.tsx || echo "no em dash"
git status --short | wc -l
```
Expected: one SUCCESS line, no ERROR; no pages listed; og:image `1` or more; sitemap `7`; stale llms routes `0`; "no em dash"; clean tree (`0`) apart from the ignored spec.

- [ ] **Step 2: Read each hub page once in the built output for accuracy**

Open `build/qod/duckdb/*/index.html` titles and skim the markdown sources against the pages they link to. Any claim not backed by the linked page is removed. Commit any fix with `docs(qod): tighten DuckDB how-to wording`.
