---
sidebar_position: 3
title: Environments
description: Configure environment-specific overrides for DEV, STAGING, and PROD
---

# Environment Configuration

Starlake uses environment files to manage configuration across DEV, STAGING, and PROD deployments.

## Environment File Hierarchy

```
metadata/
├── env.sl.yml              # Base variables (all environments)
├── env.DEV.sl.yml          # Dev-specific overrides
├── env.STAGING.sl.yml      # Staging-specific overrides
└── env.PROD.sl.yml         # Production-specific overrides
```

## Base Configuration

```yaml
# metadata/env.sl.yml
env:
  SL_ROOT: "/path/to/project"
  SL_ENV: "DEV"
  SL_INCOMING: "{{SL_ROOT}}/datasets/incoming"
  SL_PENDING: "{{SL_ROOT}}/datasets/pending"
  SL_ACCEPTED: "{{SL_ROOT}}/datasets/accepted"
  SL_REJECTED: "{{SL_ROOT}}/datasets/rejected"
  SL_BUSINESS: "{{SL_ROOT}}/datasets/business"
  SL_DATABASE: "analytics"
  SL_WAREHOUSE: "COMPUTE_WH"
```

## Environment Overrides

```yaml
# metadata/env.DEV.sl.yml
env:
  SL_ENV: "DEV"
  SL_INCOMING: "/tmp/starlake/incoming"
  SL_DATABASE: "analytics_dev"

# metadata/env.STAGING.sl.yml
env:
  SL_ENV: "STAGING"
  SL_INCOMING: "gs://staging-bucket/incoming"
  SL_DATABASE: "analytics_staging"

# metadata/env.PROD.sl.yml
env:
  SL_ENV: "PROD"
  SL_INCOMING: "gs://prod-bucket/incoming"
  SL_DATABASE: "analytics"
  SL_WAREHOUSE: "PROD_WH_XL"
```

## Using Environment Variables

Reference variables in any YAML configuration with `{{VARIABLE}}` syntax:

```yaml
transform:
  name: revenue_summary
  database: "{{SL_DATABASE}}"
  sink:
    connectionRef: "{{SL_CONNECTION}}"
```

## Selecting an Environment

Set the `SL_ENV` environment variable before running Starlake commands:

```bash
# Run in dev
export SL_ENV=DEV
starlake load --domain customers

# Run in production
export SL_ENV=PROD
starlake load --domain customers
```

Or pass it directly:

```bash
starlake load --domain customers --env PROD
```
