---
sidebar_position: 1
title: Project Structure
description: Standard Starlake project directory layout
---

# Project Structure

A standard Starlake project follows this directory layout:

```
my-project/
├── metadata/                        # All pipeline definitions
│   ├── application.sl.yml           # Global config & connections
│   ├── env.sl.yml                   # Base environment variables
│   ├── env.DEV.sl.yml               # Dev overrides
│   ├── env.PROD.sl.yml              # Prod overrides
│   │
│   ├── types/                       # Data type definitions
│   │   └── default.sl.yml           # Default type mappings
│   │
│   ├── load/                        # Ingestion configurations
│   │   └── {domain}/                # One directory per domain
│   │       ├── _config.sl.yml       # Domain-level config
│   │       └── {table}.sl.yml       # Table-level schema
│   │
│   ├── transform/                   # Transformation definitions
│   │   └── {domain}/                # One directory per output domain
│   │       ├── {task}.sl.yml        # Task configuration
│   │       ├── {task}.sql           # SQL logic
│   │       └── {task}.py            # Python logic (alternative)
│   │
│   ├── extract/                     # Extraction configurations
│   │   └── {source}.sl.yml          # Source-specific extraction
│   │
│   ├── expectations/                # Data quality macros
│   │   └── {name}.j2               # Jinja2 expectation templates
│   │
│   ├── dags/                        # Orchestration templates
│   │   └── {dag}.sl.yml             # DAG configurations
│   │
│   └── secure/                      # Security policies
│       ├── rls.sl.yml               # Row-level security
│       └── cls.sl.yml               # Column-level security
│
├── datasets/                        # Data storage areas
│   ├── incoming/                    # Raw file landing zone
│   ├── pending/                     # Staged for processing
│   ├── accepted/                    # Successfully loaded
│   ├── rejected/                    # Failed validation
│   ├── unresolved/                  # Unresolved records
│   └── business/                    # Transformed output
│
└── starlake.sh                      # CLI wrapper script
```

## Key Directories

### `metadata/`

Contains all pipeline definitions as YAML files. This is the declarative core of your project — no imperative code needed for standard operations.

### `metadata/load/{domain}/`

Each domain represents a logical grouping of tables (e.g., `customers`, `sales`, `products`). The `_config.sl.yml` file defines domain-level defaults inherited by all tables.

### `metadata/transform/{domain}/`

Transformation tasks output to domains. Each task has a YAML configuration file and a corresponding SQL or Python file.

### `datasets/`

Data flows through a pipeline of directories:

```
incoming → pending → accepted/rejected → business
```

| Directory | Purpose |
|---|---|
| `incoming` | Raw files land here (from external sources) |
| `pending` | Files staged and ready for processing |
| `accepted` | Successfully ingested records |
| `rejected` | Records that failed validation |
| `business` | Output from transformations |

## File Naming Conventions

| Pattern | Purpose |
|---|---|
| `*.sl.yml` | Starlake YAML configuration files |
| `_config.sl.yml` | Domain-level configuration (prefix with underscore) |
| `env.{ENV}.sl.yml` | Environment-specific overrides |
| `*.sql` | SQL transformation logic |
| `*.py` | Python transformation logic |
| `*.j2` | Jinja2 expectation templates |
