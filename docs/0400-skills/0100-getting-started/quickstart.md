---
sidebar_position: 2
title: Quickstart
description: Install Starlake Skills and run your first skill in 5 minutes
---

# Quickstart

Get Starlake Skills running in under 5 minutes.

## Prerequisites

- [Claude Code](https://claude.ai/code) installed and configured
- A Starlake project (or use `bootstrap` to create one)

## Step 1: Install the Plugin

### Global Installation (recommended)

Available across all your projects:

```bash
git clone https://github.com/starlake-ai/starlake-skills.git ~/.claude/skills/starlake-skills
```

### Project-Local Installation

Available only in the current project:

```bash
git clone https://github.com/starlake-ai/starlake-skills.git .claude/skills/starlake-skills
```

### From Claude Code Marketplace

```bash
# Coming soon
claude plugin install starlake-skills
```

## Step 2: Verify Installation

Open Claude Code and ask:

```
You: What Starlake skills are available?
```

Claude will list all 48 available skills organized by category.

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

Pull the latest skills:

```bash
cd ~/.claude/skills/starlake-skills && git pull
```

## Next Steps

- **[Setup](setup)**: Advanced installation options and configuration
- **[Skills Catalog](../0200-catalog/index.md)**: Full reference for all 48 skills
- **[Configuration](../0300-configure/index.md)**: Connection and warehouse setup
