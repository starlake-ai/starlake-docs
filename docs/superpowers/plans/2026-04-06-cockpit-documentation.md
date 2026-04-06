# Cockpit Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Cockpit" documentation section with two pages: a feature overview for end users and a configuration/authentication reference for admins.

**Architecture:** New `docs/0600-cockpit/` directory with a category metadata file and two `.mdx` pages. Follows existing Docusaurus conventions (numeric prefix ordering, frontmatter with SEO fields, JSON-LD structured data, auto-generated sidebar).

**Tech Stack:** Docusaurus 3.9.2, MDX, JSON-LD

**Spec:** `docs/superpowers/specs/2026-04-06-cockpit-documentation-design.md`

---

### Task 1: Create category metadata

**Files:**
- Create: `docs/0600-cockpit/_category_.json`

- [ ] **Step 1: Create the category file**

```json
{
  "label": "Cockpit",
  "position": 600,
  "collapsed": true
}
```

- [ ] **Step 2: Commit**

```bash
git add docs/0600-cockpit/_category_.json
git commit -m "docs: add Cockpit category metadata"
```

---

### Task 2: Create the overview page

**Files:**
- Create: `docs/0600-cockpit/0100-overview.mdx`

- [ ] **Step 1: Create the overview page**

Write `docs/0600-cockpit/0100-overview.mdx` with the following content:

```mdx
---
id: cockpit-overview
title: "Cockpit Overview"
description: "Starlake Cockpit is the web-based control plane for managing data projects, pipelines, transformations, and orchestration. Learn about all features available in the UI."
keywords: [starlake cockpit, web ui, data pipeline dashboard, project management, sql worksheet, orchestration, git integration]
---

import Head from '@docusaurus/Head';

<Head>
  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the Starlake Cockpit?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The Starlake Cockpit is a web-based interface for managing Starlake data projects. It provides tools for data extraction, loading, transformation, orchestration, testing, and more. Launch it with 'starlake serve' and open http://localhost:9900."
          }
        },
        {
          "@type": "Question",
          "name": "How do I launch the Starlake Cockpit?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Run 'starlake serve' from your terminal. The Cockpit opens at http://localhost:9900 by default. You can change the port with the SL_API_HTTP_PORT environment variable."
          }
        }
      ]
    })}
  </script>
</Head>

# Cockpit Overview

The Starlake Cockpit is a web-based interface for managing your data projects end-to-end. It connects to the Starlake REST API backend and provides a visual environment for every stage of the data pipeline: extraction, loading, transformation, orchestration, testing, and monitoring.

To launch the Cockpit, run:

```bash
starlake serve
```

Then open `http://localhost:9900` in your browser. See the [Configuration](./0200-configuration.mdx) page for deployment options and authentication setup.

## Projects

The home screen lists all projects in your workspace. From here you can create new projects, switch between existing ones, and manage workspace-level users. Each project has its own settings, connections, and pipeline definitions.

Within a project, members are assigned one of three roles: **Admin** (full access including settings and user management), **Owner** (project-level control), or **User** (read and execute access).

## Data Extraction

The Extraction section lets you configure jobs that pull schemas and data from external databases. You can create, edit, and delete extract configurations, each targeting a specific connection. The UI also supports extracting schemas from external sources to bootstrap load configurations.

## Data Loading

The Loading section organizes ingestion configurations by domain and table. You can browse load configurations by folder, edit domain-level and table-level settings, and configure file formats (CSV, JSON, XML, position-based), metadata, write strategies, and schema definitions.

## Data Transformation

The Transformation section provides a notebook-style editor for SQL and Python transform jobs. You can create and edit jobs, validate SQL syntax against the target database, and preview transformation logic. Each job maps to a named transform that can be orchestrated independently.

## Semantic Modeling

The Semantic Modeling section offers a visual diagram editor for defining domains, tables, and their relationships. You can drag and arrange entities, define columns and types, and visualize the data model as an interactive flow diagram powered by React Flow.

## SQL Worksheet

The SQL Worksheet is an interactive editor for running ad-hoc queries against your project data. It supports syntax highlighting, autocompletion, and result display in a data grid. Use it to explore data, validate queries, or test transformation logic before committing it to a job.

## Orchestration

The Orchestration section manages workflow scheduling and execution. You can build DAGs from templates, generate orchestration code for Airflow, Dagster, or Snowflake tasks, and trigger runs directly from the UI. The schedule configuration page lets you define cron-based schedules for automated pipeline execution.

## Data Quality and Testing

The Testing section lets you define and run data quality checks using expectations. You can configure tests per job, run them against live data, and view results. The monitoring dashboard tracks data freshness and surfaces quality metrics over time.

## Git Integration

The Git section provides full version control for your project metadata. You can view status, stage and commit changes, create and switch branches, push to and pull from remotes, and resolve merge conflicts. The version history page shows the commit log for your project.

## AI Assistant

The AI Assistant is available across the Loading and Transformation sections as a chat interface. It can generate column descriptions from sample data, explain SQL queries, suggest fixes for errors, and help scaffold new configurations. Responses stream in real time.

## Settings

The Settings section groups all project configuration:

- **General** — project name, description, and metadata
- **Application** — application YAML configuration with validation
- **Connections** — database connection templates and credentials
- **Environment Variables** — project-level key-value pairs for pipeline configuration
- **Custom Types** — user-defined data types alongside built-in defaults
- **Schedule** — job scheduling configuration
- **Members** — project team members, roles, and invitations
- **Git References** — branch and tag management
```

- [ ] **Step 2: Commit**

```bash
git add docs/0600-cockpit/0100-overview.mdx
git commit -m "docs: add Cockpit overview page"
```

---

### Task 3: Create the configuration and authentication page

**Files:**
- Create: `docs/0600-cockpit/0200-configuration.mdx`

- [ ] **Step 1: Create the configuration page**

Write `docs/0600-cockpit/0200-configuration.mdx` with the following content:

```mdx
---
id: cockpit-configuration
title: "Cockpit Configuration"
description: "Configure the Starlake Cockpit REST API: deployment modes, HTTP server, sessions, database, authentication providers (OAuth, OIDC), email, AI integration, orchestration, and storage."
keywords: [starlake cockpit configuration, authentication, oauth, oidc, api configuration, session management, smtp, ai integration]
---

import Head from '@docusaurus/Head';

<Head>
  <script type="application/ld+json">
    {JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What authentication providers does the Starlake Cockpit support?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The Cockpit supports email/password (built-in), Google OAuth, GitHub OAuth, Azure OAuth, generic OIDC, and Snowflake OAuth. Configure each provider with its client ID and secret via environment variables."
          }
        },
        {
          "@type": "Question",
          "name": "What database does the Starlake Cockpit use for user management?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The Cockpit uses PostgreSQL for user management, project metadata, and configuration storage. Configure the connection with SL_API_JDBC_URL, SL_API_JDBC_USER, and SL_API_JDBC_PASSWORD environment variables."
          }
        }
      ]
    })}
  </script>
</Head>

# Cockpit Configuration

This page documents the environment variables and settings for deploying the Starlake Cockpit and its REST API backend. All settings are configured through environment variables.

## Deployment Modes

The `SL_API_MODE` variable controls which authentication methods are available:

| Mode | Description |
|------|-------------|
| `LOCAL` | On-premises deployment. Only email/password authentication is enabled. This is the default. |
| `CLOUD` | Cloud deployment. OAuth providers are enabled. |
| `ALL` | Both on-premises and cloud authentication methods are available. |
| `SAAS` | Multi-tenant SaaS mode with user isolation, disk quotas, and all authentication methods. |

## HTTP Server

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_HTTP_PORT` | Port the API server listens on | `9900` |
| `SL_API_HTTP_INTERFACE` | Network interface to bind to | `0.0.0.0` |
| `SL_API_HTTP_FRONT_URL` | Public URL of the Cockpit frontend | `http://localhost:9900` |
| `SL_API_FILE_UPLOAD_MAX_CONTENT_LENGTH` | Maximum file upload size | `1000 MiB` |

## Session and Cookies

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_SERVER_SECRET` | Secret key used to encrypt session cookies. **Change this in production.** | Built-in default |
| `SL_API_DOMAIN` | Cookie domain for session cookies | `starlake.ai` |
| `SL_API_SECURE` | Set to `true` to require HTTPS for cookies | `true` |
| `SL_API_SESSION_AS_HEADER` | Send session data as a header in addition to the cookie | `true` |
| `SL_API_MAX_AGE_MINUTES` | Session expiration time in minutes | `120` |

## Database

The Cockpit stores user accounts, project metadata, and configuration in a PostgreSQL database.

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_JDBC_URL` | JDBC connection URL | *Required* |
| `SL_API_JDBC_USER` | Database username | *Required* |
| `SL_API_JDBC_PASSWORD` | Database password | *Required* |
| `SL_API_JDBC_DRIVER` | JDBC driver class | `org.postgresql.Driver` |
| `SL_API_JDBC_HOST` | Database host | `starlake-db` |
| `SL_API_JDBC_PORT` | Database port | `5432` |

Database schema migrations are applied automatically on startup using Flyway.

## Authentication Providers

### Email and Password

Built-in authentication with no additional configuration required. Users register with an email address and password. Accounts are locked after 10 consecutive failed login attempts (configurable via `SL_API_AUTH_MAX_FAILURES`).

### Google OAuth

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | *Empty — disabled* |
| `SL_API_GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | *Empty — disabled* |

Set both variables to enable Google sign-in. Create credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with the callback URL `<front-url>/api/v1/auth/google/callback`.

### GitHub OAuth

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_GITHUB_CLIENT_ID` | GitHub OAuth app client ID | *Empty — disabled* |
| `SL_API_GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret | *Empty — disabled* |

Set both variables to enable GitHub sign-in. Create an OAuth app in [GitHub Settings](https://github.com/settings/developers) with the callback URL `<front-url>/api/v1/auth/github/callback`.

### Azure OAuth

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_AZURE_CLIENT_ID` | Azure AD application (client) ID | *Empty — disabled* |
| `SL_API_AZURE_CLIENT_SECRET` | Azure AD client secret | *Empty — disabled* |

Set both variables to enable Azure sign-in. Register an application in the [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps) with the callback URL `<front-url>/api/v1/auth/azure/callback`.

### OIDC (Generic)

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_OIDC_CLIENT_ID` | OIDC client ID | *Empty — disabled* |
| `SL_API_OIDC_CLIENT_SECRET` | OIDC client secret | *Empty — disabled* |
| `SL_API_OIDC_DISCOVERY_URL` | OpenID Connect discovery URL (e.g., `https://idp.example.com/.well-known/openid-configuration`) | *Empty — disabled* |

Set all three variables to enable generic OIDC sign-in. This works with any OIDC-compliant identity provider (Okta, Auth0, Keycloak, etc.).

### Snowflake OAuth

Snowflake OAuth is configured through the platform settings table in the database rather than environment variables. It supports automatic token refresh when tokens expire.

## Email (SMTP)

Configure SMTP to enable email notifications, magic link sign-up, and password reset.

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_MAIL_FROM` | Sender email address | `contact@starlake.ai` |
| `SL_API_MAIL_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SL_API_MAIL_PORT` | SMTP server port | `587` |
| `SL_API_MAIL_USER` | SMTP authentication username | *Required* |
| `SL_API_MAIL_PASSWORD` | SMTP authentication password | *Required* |
| `SL_API_MAIL_TLS` | Enable TLS for SMTP connections | `true` |

## AI Integration

The AI assistant requires a running LLM service endpoint.

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_AI_URL` | URL of the AI/LLM service | `http://localhost:8000` |
| `SL_API_AI_MODEL` | Default model name | `llama3:latest` |
| `SL_AI_APPLICATION_KEY` | Application key for the AI service | `unknown` |
| `SL_API_AI_MODEL_NAMES` | Comma-separated list of enabled AI providers | `openai,gemini,claude,anthropic` |

## Orchestrator

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_ORCHESTRATOR_URL` | Orchestrator web UI URL (Airflow, Dagster) | `http://localhost/airflow/` |
| `SL_API_ORCHESTRATOR_PRIVATE_URL` | Internal orchestrator API URL (if different from public URL) | *Empty* |
| `SL_API_AIRFLOW_USER` | Airflow basic auth username | `airflow` |
| `SL_API_AIRFLOW_PASSWORD` | Airflow basic auth password | `airflow` |

## Storage and Limits

| Variable | Description | Default |
|----------|-------------|---------|
| `SL_API_PROJECTS_ROOT` | Root directory for all project files on the server | *Empty* |
| `SL_API_MAX_USER_SPACE_MB` | Maximum disk space per user in MB (SAAS mode) | `1` |
| `SL_API_DAG_FOLDER` | Directory name for generated DAG files relative to project root | `dags` |
```

- [ ] **Step 2: Commit**

```bash
git add docs/0600-cockpit/0200-configuration.mdx
git commit -m "docs: add Cockpit configuration and authentication reference"
```

---

### Task 4: Build verification

- [ ] **Step 1: Run the Docusaurus build to verify no errors**

```bash
cd /Users/hayssams/git/public/starlake-docs
yarn build
```

Expected: build completes with no errors, new Cockpit section appears in sidebar.

- [ ] **Step 2: Fix any build errors if needed**

If build fails, read the error output and fix the offending file.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add docs/0600-cockpit/
git commit -m "docs: fix Cockpit build issues"
```

---

### Task 5: Commit and push

- [ ] **Step 1: Push all commits to remote**

```bash
git push
```
