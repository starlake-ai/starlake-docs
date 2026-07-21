---
sidebar_position: 2
title: Quickstart
description: Install Starlake Skills and run your first skill in 5 minutes
---

# Quickstart

Get Starlake Skills running in under 5 minutes.

## Prerequisites

- An AI coding assistant: [Claude Code](https://claude.ai/code), GitHub Copilot, or Gemini CLI (examples below use Claude Code syntax)
- A Starlake project (or use `bootstrap` to create one)

## Step 1: Install the Skills

### Quick Install from a Release (recommended)

Downloads the latest [GitHub Release](https://github.com/starlake-ai/starlake-skills/releases) and links the skills into Claude Code, GitHub Copilot, and Gemini CLI. No git or Node required:

```bash
curl -fsSL https://raw.githubusercontent.com/starlake-ai/starlake-skills/main/scripts/install-remote.sh | bash
```

On Windows, use `scripts/install-remote.ps1`. Pass `--pin vX.Y.Z` for an exact release, or `--platforms claude` to install for one assistant only.

### From a Git Clone (contributors)

Skills are symlinked from the clone, so edits and `git pull` are live immediately:

```bash
git clone https://github.com/starlake-ai/starlake-skills.git ~/.starlake-skills
~/.starlake-skills/scripts/install.sh
```

Add `--local` to install into the current project instead of your home directory.

## Step 2: Verify Installation

Open your assistant and ask:

```
You: What Starlake skills are available?
```

Claude will list the available skills organized by category.

## Step 3: Try Your First Skill

### Bootstrap a new project

```
You: /bootstrap a new Starlake project targeting DuckDB
```

Claude will generate a complete project structure with:
- `metadata/application.sl.yml` — Global configuration
- `metadata/types/default.sl.yml` — Type definitions
- `metadata/env.sl.yml` — Environment variables
- Sample domain and table configurations

### Load data

```
You: /load Help me configure loading CSV files into a "customers" domain
     with columns: id, name, email, created_at
```

Claude will create the domain config and table schema YAML files with appropriate types, write strategy, and sink configuration.

### Generate DAGs

```
You: /dag-generate Create Airflow DAGs for all my domains with a daily schedule
```

Claude will generate Python DAG files for Apache Airflow based on your pipeline configuration.

## Step 4: Explore More

Try these common workflows:

| Task | Command |
|---|---|
| Validate project | `/validate` |
| Column lineage | `/col-lineage` |
| Extract schema from DB | `/extract-schema` |
| Configure connections | `/connection` |
| Data quality checks | `/expectations` |
| Security policies | `/secure` |

## Updating

Release installs: re-run the quick-install one-liner. Git clones: `git pull`, then `scripts/install.sh --update` if skills were added or removed. Check the installed version any time with `scripts/install.sh --version`.

## Next Steps

- **[Setup](setup)**: Advanced installation options and configuration
- **[Skills Catalog](../0200-catalog/index.md)**: Full reference for all skills
- **[Configuration](../0300-configure/index.md)**: Connection and warehouse setup
