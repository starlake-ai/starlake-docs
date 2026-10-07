# Orchestration Capabilities

## 1. DAG Generation

Starlake generates orchestration DAGs automatically from the dependency graph of load and transform jobs. No manual DAG writing is required.

```bash
# Generate all DAGs
starlake dag-generate

# Generate with options
starlake dag-generate --clean --domains --tasks --tags tag1

# Custom output directory
starlake dag-generate --outputDir /path/to/dags
```

## 2. Supported Orchestrators

| Orchestrator | Execution Environments |
|---|---|
| **Apache Airflow** (2.4.0+) | Bash, Cloud Run (GCP), Dataproc (GCP), Fargate (AWS) |
| **Dagster** (1.6.0+) | Shell, Cloud Run (GCP), Dataproc (GCP), Fargate (AWS) |
| **Snowflake Tasks** | Snowpark SQL (native) |

## 3. Automatic Dependency Resolution

Starlake parses `FROM` and `JOIN` clauses in SQL transform files to build a directed acyclic graph (DAG). Upstream tables always execute before downstream ones. Both load-to-transform and transform-to-transform dependencies are detected.

## 4. Dependency Strategies

Two strategies control how dependencies are executed:

### Inline Dependencies

All upstream loads and transforms are included in the same DAG. Simpler, single point of execution.

```yaml
options:
  run_dependencies_first: "true"
```

### Data-Aware Scheduling (default)

Each DAG runs independently. Downstream DAGs are triggered when upstream datasets are updated:

- **Airflow**: uses native Airflow Datasets.
- **Dagster**: uses Multi Asset Sensors to monitor materializations.

```yaml
options:
  run_dependencies_first: "false"
```

The `dataset_triggering_strategy` option controls when downstream DAGs fire:

| Value | Behavior |
|---|---|
| `any` (default) | Any single upstream dataset update triggers the DAG |
| `all` | All upstream datasets must be updated before trigger |
| Custom expression | Boolean expression, e.g. `dataset1 & (dataset2 \| dataset3)` |

## 5. Lineage Visualization

```bash
# Print dependency tree as text
starlake lineage --task kpi.order_summary --print

# Generate SVG (requires GraphViz)
starlake lineage --task kpi.order_summary --svg --output lineage.svg

# Other formats
starlake lineage --png --output lineage.png
starlake lineage --json --output lineage.json

# Column-level lineage
starlake col-lineage --task kpi.order_summary
```

Options: `--all` (include all tasks), `--objects task,table,view` (filter by type), `--verbose` (extra properties).

## 6. DAG Configuration Hierarchy

DAG references (`dagRef`) can be set at three levels. Each level overrides the one above:

### Project Level

```yaml
# metadata/application.sl.yml
application:
  dagRef:
    load: airflow_bash_load
    transform: airflow_bash_transform
```

### Domain Level

```yaml
# metadata/load/{domain}/_config.sl.yml
load:
  metadata:
    dagRef: airflow_bash_load
```

### Table / Task Level

```yaml
# metadata/load/{domain}/{table}.sl.yml
table:
  metadata:
    dagRef: airflow_bash_load

# metadata/transform/{domain}/{task}.sl.yml
task:
  dagRef: airflow_bash_transform
```

## 7. DAG Definition Structure

Each DAG definition lives in `metadata/dags/` as a YAML file referencing a Jinja2 template:

```yaml
dag:
  comment: "Daily sales pipeline"
  template: "load/airflow_scheduled_table_bash.py.j2"
  filename: "dag_{{domain}}.py"
  options:
    schedule: "0 2 * * *"
    start_date: "2024-01-01"
    tags: "sales production"
```

### Filename Variables

The `filename` property controls DAG granularity:

| Pattern | Result |
|---|---|
| `dag_{{domain}}.py` | One DAG per domain |
| `dag_{{domain}}_{{table}}.py` | One DAG per table |
| `dag_all.py` | Single DAG for everything |

## 8. Scheduling Options

| Option | Description | Default |
|---|---|---|
| `schedule` | Cron expression or preset name | — |
| `start_date` | Start date (YYYY-MM-DD) | — |
| `end_date` | End date (Airflow only) | — |
| `timezone` | Scheduling timezone | UTC |
| `cron_period_frequency` | Granularity: `day`, `week`, `month`, `year` | `week` |

### Data Cycle Management

| Option | Description | Default |
|---|---|---|
| `data_cycle_enabled` | Enable data cycle validation | — |
| `data_cycle` | Frequency: `hourly`, `daily`, `weekly`, `monthly`, `yearly`, or cron | — |
| `beyond_data_cycle_enabled` | Allow runs outside cycle window | `true` |
| `min_timedelta_between_runs` | Minimum seconds between runs | `900` (15 min) |

## 9. Pre-Load Strategies

Controls when domain tables are loaded within the DAG:

| Strategy | Behavior |
|---|---|
| `NONE` (default) | Unconditional load |
| `IMPORTED` | Checks for files in landing area, calls `sl_import` to stage them, skips if none found |
| `PENDING` | Checks for files in pending datasets, skips if none found |
| `ACK` | Waits for an acknowledgment file before loading (configurable path and timeout) |

```yaml
options:
  pre_load_strategy: "ack"
  global_ack_file_path: "${SL_ROOT}/datasets/pending/{domain}/{date}.ack"
  ack_wait_timeout: "3600"
```

## 10. Retry and Failure Handling

| Option | Description | Default |
|---|---|---|
| `retries` | Number of retry attempts | `1` |
| `retry_delay` | Delay between retries (seconds) | `300` |
| `retry_on_failure` | Retry on failure (Cloud Run / Fargate) | `false` |
| `retry_delay_in_seconds` | Retry delay for Cloud Run | `10` |

### Airflow Default DAG Args

```yaml
options:
  default_dag_args: '{"depends_on_past": false, "email_on_failure": false, "retries": 1, "retry_delay": 300}'
  max_active_runs: "3"
```

### Async Execution (Cloud Run / Fargate)

| Option | Description | Default |
|---|---|---|
| `cloud_run_async` | Enable async with completion sensor | `true` |
| `cloud_run_async_poke_interval` | Polling interval (seconds) | `10` |
| `fargate_async_poke_interval` | Polling interval (seconds) | `30` |

## 11. Execution Environment Options

### Bash / Shell

| Option | Description |
|---|---|
| `SL_STARLAKE_PATH` | Path to starlake CLI (default: `starlake`) |
| `sl_env_var` | JSON-encoded environment variables |
| `sl_include_env_vars` | Comma-separated OS env vars to forward (or `*` for all) |

### Cloud Run (GCP)

| Option | Description |
|---|---|
| `cloud_run_project_id` | GCP project ID |
| `cloud_run_job_name` | Cloud Run job name (required) |
| `cloud_run_region` | Region (default: `europe-west1`) |
| `cloud_run_service_account` | Service account |

### Dataproc (GCP)

| Option | Description |
|---|---|
| `dataproc_project_id` | GCP project ID |
| `dataproc_name` | Cluster name (default: `dataproc-cluster`) |
| `dataproc_region` | Region (default: `europe-west1`) |
| `dataproc_idle_delete_ttl` | Delete idle cluster after N seconds (default: `3600`) |

### Fargate (AWS)

| Option | Description |
|---|---|
| `aws_cluster_name` | ECS cluster name (required) |
| `aws_task_definition_name` | Task definition (required) |
| `aws_task_definition_container_name` | Container name (required) |
| `aws_task_private_subnets` | JSON array of subnet IDs (required) |
| `aws_task_security_groups` | JSON array of security group IDs (required) |
| `cpu` | CPU units (default: `1024`) |
| `memory` | Memory MB (default: `2048`) |

### Snowflake Tasks

| Option | Description |
|---|---|
| `stage_location` | Snowflake stage path (required, e.g., `@my_stage/path`) |
| `warehouse` | Warehouse name |
| `packages` | Python packages (default: `croniter,python-dateutil`) |
| `allow_overlapping_execution` | Allow backfill (default: `false`) |

## 12. Template Customization

DAG templates are Jinja2 files. Starlake ships built-in templates for every orchestrator × environment combination. Custom templates can be placed in `metadata/dags/templates/`.

**Template resolution order:**
1. Absolute path
2. Relative to `metadata/dags/templates/`
3. Built-in from starlake resources

### Transform Parameters

```python
jobs = {
    "domain.transform": {
        "options": "param1=value1,param2=value2"
    }
}
```

### Airflow User-Defined Macros

```python
user_defined_macros = {
    "days_interval": custom_function
}
```

## 13. Deployment Workflow

1. **Generate**: `starlake dag-generate` analyzes YAML configs and SQL dependencies, produces Python/SQL files.
2. **Deploy**: copy generated files to the orchestrator (Airflow `dags/` folder, Dagster repository, or Snowflake stage).
3. **Backfill** (optional): replay historical intervals with correct `sl_start_date` / `sl_end_date` values.

---

## Summary

| Capability | Category |
|---|---|
| Automatic DAG generation from YAML + SQL dependencies | Core |
| Airflow, Dagster, Snowflake Tasks support | Orchestrators |
| Bash, Cloud Run, Dataproc, Fargate execution | Environments |
| SQL-based dependency resolution (FROM / JOIN parsing) | Dependencies |
| Inline vs data-aware scheduling strategies | Dependencies |
| Dataset triggering (any / all / custom expression) | Dependencies |
| Lineage visualization (text, SVG, PNG, JSON, column-level) | Observability |
| Three-level dagRef hierarchy (project, domain, table) | Configuration |
| Filename variables for DAG granularity | Configuration |
| Cron scheduling and data cycle management | Scheduling |
| Pre-load strategies (NONE, IMPORTED, PENDING, ACK) | Scheduling |
| Retry, timeout, and async completion sensors | Reliability |
| Custom Jinja2 templates | Extensibility |
| Transform parameters and user-defined macros | Extensibility |
