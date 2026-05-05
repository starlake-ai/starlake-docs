# Cockpit Documentation Design

**Date:** 2026-04-06
**Status:** Approved

## Goal

Add a new top-level documentation section documenting the Starlake Cockpit (Web UI). The section serves two audiences: end users who need a reference of available features, and admins who need to configure and deploy the Cockpit with its REST API backend.

## Decisions

- **Section name:** "Cockpit" (consistent with existing references in the docs)
- **Location:** `docs/0600-cockpit/` — between Configuration (0500) and Comparisons (0700)
- **Structure:** Two pages (Approach B)
- **Feature docs style:** Reference-style (brief descriptions, not step-by-step walkthroughs)
- **API coverage:** Configuration and authentication only (no full endpoint reference)

## File Structure

```
docs/0600-cockpit/
├── _category_.json          # label: "Cockpit", position: 6
├── 0100-overview.mdx        # Features overview (end users + admins)
└── 0200-configuration.mdx   # Configuration & authentication (admins)
```

## Page 1: Overview (`0100-overview.mdx`)

Reference-style description of every major feature available through the Web UI.

### Sections

1. **Intro**: what the Cockpit is, how to launch it (`starlake serve`), default URL (`http://localhost:9900`)
2. **Projects**: create, manage, switch between projects; workspace and project-level user management; roles (ADMIN, USER, OWNER)
3. **Data Extraction**: configure extract jobs from external databases; schema extraction
4. **Data Loading**: domain/table configuration; browse and edit load configs by folder
5. **Data Transformation**: SQL/Python transform job editor; validation; notebook-style editor
6. **Semantic Modeling**: visual diagram editor for domains, tables, and relationships
7. **SQL Worksheet**: interactive SQL editor for ad-hoc queries against project data
8. **Orchestration**: DAG builder and management; Airflow/Dagster/Snowflake integration; schedule configuration
9. **Data Quality & Testing**: expectations management; test execution; freshness monitoring
10. **Git Integration**: branch management, stage, commit, push, pull, conflict resolution, version history
11. **AI Assistant**: streaming AI chat for generating configs; column descriptions from samples; SQL explanation and fix
12. **Settings**: application config, connections, environment variables, custom types, scheduling, project members

Each feature: 2-4 sentences describing what it does and where to find it in the UI. No step-by-step instructions.

### Conventions

- Frontmatter with `id`, `title`, `description`, `keywords`
- JSON-LD schema in `<Head>` for SEO (FAQPage or HowTo as appropriate)
- Standard Docusaurus imports (Tabs, TabItem, Head)

## Page 2: Configuration & Authentication (`0200-configuration.mdx`)

Admin reference for all environment variables and auth setup needed to deploy and run the Cockpit.

### Sections

1. **Deployment Modes**: 4 API modes:
   - `LOCAL` — on-premises, basic auth only
   - `CLOUD` — cloud deployment, OAuth enabled
   - `ALL` — both on-premises and cloud auth
   - `SAAS` — multi-tenant SaaS mode

2. **HTTP Server**: env var table:
   - `SL_API_HTTP_PORT` (default 9900), `SL_API_HTTP_INTERFACE`, `SL_API_HTTP_FRONT_URL`, `SL_API_FILE_UPLOAD_MAX_CONTENT_LENGTH`

3. **Session & Cookies**: env var table:
   - `SL_API_SERVER_SECRET`, `SL_API_DOMAIN`, `SL_API_SECURE`, `SL_API_SESSION_AS_HEADER`, `SL_API_MAX_AGE_MINUTES`

4. **Database (User Management)**: env var table:
   - `SL_API_JDBC_URL`, `SL_API_JDBC_USER`, `SL_API_JDBC_PASSWORD`, `SL_API_JDBC_DRIVER`, `SL_API_JDBC_HOST`, `SL_API_JDBC_PORT`
   - Note: PostgreSQL is the primary supported database

5. **Authentication Providers**: subsection per provider:
   - **Basic (Email/Password)**: built-in, no extra config; account lockout after max failures
   - **Google OAuth**: `SL_API_GOOGLE_CLIENT_ID`, `SL_API_GOOGLE_CLIENT_SECRET`
   - **GitHub OAuth**: `SL_API_GITHUB_CLIENT_ID`, `SL_API_GITHUB_CLIENT_SECRET`
   - **Azure OAuth**: `SL_API_AZURE_CLIENT_ID`, `SL_API_AZURE_CLIENT_SECRET`
   - **OIDC (Generic)**: `SL_API_OIDC_CLIENT_ID`, `SL_API_OIDC_CLIENT_SECRET`, `SL_API_OIDC_DISCOVERY_URL`
   - **Snowflake OAuth**: configured via platform table; supports token refresh

6. **Email (SMTP)**: env var table:
   - `SL_API_MAIL_FROM`, `SL_API_MAIL_HOST`, `SL_API_MAIL_PORT`, `SL_API_MAIL_USER`, `SL_API_MAIL_PASSWORD`, `SL_API_MAIL_TLS`

7. **AI Integration**: env var table:
   - `SL_API_AI_URL`, `SL_API_AI_MODEL`, `SL_AI_APPLICATION_KEY`, `SL_API_AI_MODEL_NAMES`

8. **Orchestrator**: env var table:
   - `SL_API_ORCHESTRATOR_URL`, `SL_API_ORCHESTRATOR_PRIVATE_URL`, `SL_API_AIRFLOW_USER`, `SL_API_AIRFLOW_PASSWORD`

9. **Storage & Limits**: env var table:
   - `SL_API_PROJECTS_ROOT`, `SL_API_MAX_USER_SPACE_MB`, `SL_API_DAG_FOLDER`

### Table Format

Each section uses a 3-column table:

| Variable | Description | Default |
|----------|-------------|---------|

## Source Material

- **Web UI codebase:** `/Users/hayssams/git/starlake-ui2` (Next.js 14, TypeScript, MUI)
- **API codebase:** `/Users/hayssams/git/starlake-api` (Scala, Tapir, Pekko HTTP)
- **API config reference:** `/Users/hayssams/git/starlake-api/src/main/resources/reference-api.conf`
- **Existing serve docs:** `docs/0800-cli/serve.md`
