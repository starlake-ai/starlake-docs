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

## Architecture

### Dual-Site Strategy

A single codebase serves two sites controlled by `IS_BLOG` env var. The `docusaurus.config.js` conditionally configures navbar items, plugins, and content based on this flag.

### Guides System

Interactive guides live in `src/data/guides/` as markdown files with frontmatter (title, description, tags, level, icon). The `scripts/generate-guides-data.js` build step parses these files, extracts `##` headers as tab sections, and writes `src/data/guides-data.json`. The `src/pages/guides.js` component renders this data as a filterable, tabbed UI. **This generation runs automatically before `yarn start` and `yarn build`.**

### Documentation Numbering Convention

Docs use numeric prefixes for ordering: `0000-overview.md`, `0200-setup/`, `0300-guides/`, etc. Subdirectories follow the same pattern. The sidebar is auto-generated from this structure (`sidebars.js`).

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
