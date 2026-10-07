# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Documentation site for [Starlake](https://github.com/starlake-ai/starlake), an open-source declarative data pipeline platform. Built with **Docusaurus 3.9.2** and deployed to Cloudflare Pages at https://docs.starlake.ai (docs) and https://blog.starlake.ai (blog).

## Development Commands

```bash
# Install dependencies (uses Yarn, requires Node 20+)
yarn install

# Start dev server (generates guides data, then starts Docusaurus)
yarn start

# Production build
yarn build

# Serve production build locally
yarn serve

# Clear Docusaurus cache (useful when builds behave unexpectedly)
yarn clear

# Regenerate guides data only
yarn generate-guides-data
```

## Environment Variables

- `BASE_URL` — sets the site base URL (default: `/starlake/`)
- `IS_BLOG` — when set, switches site to blog mode (separate nav/content for blog.starlake.ai)
- `QOD_DOCS_GA_ID` — GA4 measurement ID receiving page views for every page under `/qod` (optional)
- `STARFLOW_DOCS_GA_ID` — GA4 measurement ID receiving page views for every page under `/starflow` (optional)

## Architecture

### Dual-Site Strategy

A single codebase serves two sites controlled by `IS_BLOG` env var. The `docusaurus.config.js` conditionally configures navbar items, plugins, and content based on this flag.

### Guides System

Interactive guides live in `src/data/guides/` as markdown files with frontmatter (title, description, tags, level, icon). The `scripts/generate-guides-data.js` build step parses these files, extracts `##` headers as tab sections, and writes `src/data/guides-data.json`. The `src/pages/guides.js` component renders this data as a filterable, tabbed UI. **This generation runs automatically before `yarn start` and `yarn build`.**

### Documentation Numbering Convention

Docs use numeric prefixes for ordering: `0000-overview.md`, `0200-setup/`, `0300-guides/`, etc. Subdirectories follow the same pattern. The sidebar is auto-generated from this structure (`sidebars.js`).

### Documentation Versioning

QoD and Starflow are separate docs instances, versioned independently with their own release numbers:

| Product | Live (unreleased) tree | Snapshots | Version list | Cut a release |
|---|---|---|---|---|
| Starflow (`default` instance) | `docs/` → `/starflow/next` | `versioned_docs/`, `versioned_sidebars/` | `versions.json` | `yarn docusaurus docs:version <x.y.z>` |
| QoD (`qod` instance) | `qod/` → `/qod/next` | `qod_versioned_docs/`, `qod_versioned_sidebars/` | `qod_versions.json` | `yarn docusaurus docs:version:qod <x.y.z>` |

- The newest snapshot is served at the unprefixed route (`/qod/...`, `/starflow/...`); older ones at `/qod/<version>/...`.
- `Next` pages show an "unreleased" banner, are `noindex`, and are left out of the sitemap.
- Edits for upcoming releases go in `docs/` or `qod/`. Fix a released version by editing its snapshot directly.
- After `docs:version` (Starflow), delete `versioned_docs/version-<x.y.z>/superpowers/` (internal plans, excluded from the build).
- In `Next` docs, link to pages in the same instance with relative file links (`./foo.md`). An absolute `/qod/foo` link resolves to the latest snapshot and breaks the build when the page only exists in `Next`.
- Each navbar version dropdown (`custom-sectionVersionDropdown`, `src/components/SectionVersionDropdown/`) renders only inside its own instance.
- Blog mode sets `disableVersioning`, so `versions.json` never affects blog.starlake.ai.

### Content Locations

- `docs/` — main documentation (setup, guides, configuration, CLI reference, dev guides)
- `blog/` — published blog posts; authors defined in `blog/authors.yml`
- `blog-coming-articles/` — draft/upcoming blog posts
- `src/data/guides/` — interactive guide content (parsed at build time)
- `static/img/` — images and diagrams

### Custom Components

- `src/components/Card/` — reusable card UI (CardHeader, CardBody, CardImage, CardFooter)
- `src/components/StructuredData.js` — Schema.org JSON-LD metadata for SEO
- `src/theme/` — swizzled Docusaurus theme overrides (Footer, MDXComponents, Root)

### Plugins

- `@easyops-cn/docusaurus-search-local` — local search (no external API needed)
- `docusaurus-plugin-image-zoom` — click-to-zoom images
- `@docusaurus/theme-mermaid` — Mermaid diagram support in markdown
