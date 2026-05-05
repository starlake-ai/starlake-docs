---
id: starflow-overview
sidebar_position: 1
title: "Starflow Method (Preview)"
description: Guided methodology for planning and implementing data pipelines with Starlake
---

# Starflow Method (Preview)

:::info Preview
Starflow is currently in **preview**. The methodology and skills are available for early adopters, but APIs and workflows may change.
:::

:::caution Preview limitations
- Skill names, the manifest schema (`_config/starflow-help.csv`), and config layering rules may change between releases.
- The layered config resolver requires Python 3 with PyYAML on the host running the skill.
- Step-file workflows assume the artifact lives under `planning-artifacts/` or `implementation-artifacts/` (configurable, see below). Moving the file mid-workflow breaks resume.
- Persona voices are tuned for Claude; behavior on other assistants (Copilot, Gemini) may diverge.
:::

Starflow is an optional guided methodology layer that helps you plan and implement data pipelines step-by-step. While Starlake Skills give you direct access to every CLI command, Starflow provides a structured workflow with specialized agent personas that guide you through the full lifecycle, from domain discovery to production deployment.

## When to Use Starflow

- **Greenfield projects**: starting a new data platform from scratch
- **Complex migrations**: moving from legacy ETL to Starlake
- **Team onboarding**: structured approach for teams new to Starlake
- **Architecture reviews**: systematic evaluation of existing pipelines

For quick, targeted tasks (loading a file, writing a transform), use the [CLI skills](../0200-catalog/index.md) directly.

## Workflow Phases

Starflow organizes work into four phases, each with dedicated skills:

```
        1. Discovery
             │
             ▼
        2. Architecture
             │
             ▼
  ┌──▶  3. Pipeline Design
  │          │
  │          ▼
  │     4. Implementation
  │          │  sprint → dev → review → retro
  └──────────┘
        next epic

  Quality Review (cross-cutting, run at any phase):
    • starflow-data-quality-review
    • starflow-lineage-review
```

### Phase 1: Discovery

Map your data landscape before writing any configuration.

| Skill | Description |
|---|---|
| `starflow-domain-discovery` | Identify and document data domains, sources, and ownership |
| `starflow-source-analysis` | Deep-dive into source schemas, quality, volume, and extraction strategies |

### Phase 2: Architecture

Design the platform and schemas that will support your pipelines. See also: [Schema Management](../0200-catalog/schema-management.md).

| Skill | Description |
|---|---|
| `starflow-create-data-architecture` | Design layers (raw, staging, mart), engines, storage, and governance |
| `starflow-schema-design` | Design Starlake-compatible table schemas with types, constraints, privacy, and expectations |

### Phase 3: Pipeline Design

Specify pipelines end-to-end before implementation. See also: [Ingestion](../0200-catalog/ingestion.md), [Transformation](../0200-catalog/transformation.md), [Orchestration](../0200-catalog/orchestration.md).

| Skill | Description |
|---|---|
| `starflow-create-pipeline-spec` | Create complete pipeline specifications covering extract, load, transform, and orchestrate |
| `starflow-transform-design` | Design SQL transformations with quality checks and dependency management |
| `starflow-orchestration-design` | Design DAGs, schedules, and retry/timeout policies for pipeline execution |

### Phase 4: Implementation

Build, test, deploy, and reflect on your pipelines. See also: [Ingestion](../0200-catalog/ingestion.md), [Transformation](../0200-catalog/transformation.md).

| Skill | Description |
|---|---|
| `starflow-sprint-planning` | Break down pipeline work into sprint-sized tasks with dependency ordering |
| `starflow-dev-pipeline` | Generate Starlake configuration files (YAML + SQL) from specifications |
| `starflow-code-review` | Adversarial parallel review (Winston + Amelia + Quinn) before deployment |
| `starflow-retrospective` | End-of-epic retrospective that checks follow-through on the previous retro's action items |

### Quality Review

Cross-cutting skills for validating pipelines at any phase. See also: [Data Quality](../0200-catalog/data-quality.md), [Lineage](../0200-catalog/lineage.md).

| Skill | Description |
|---|---|
| `starflow-data-quality-review` | Review expectations coverage and identify gaps across pipelines |
| `starflow-lineage-review` | Trace and document data lineage across pipeline stages |

## What Starflow Produces

Each skill writes a markdown artifact you can read, version, and iterate on. The default output layout (configurable; see [Layered Configuration](#layered-configuration) below) is:

```
{project-root}/starflow-output/
├── planning-artifacts/
│   ├── domain-discovery-*.md       # Phase 1
│   ├── source-analysis-*.md        # Phase 1
│   ├── data-architecture-*.md      # Phase 2
│   └── schema-design-*.md          # Phase 2
└── implementation-artifacts/
    ├── pipeline-spec-*.md          # Phase 3 (step-file workflow)
    ├── transform-design-*.md       # Phase 3
    ├── orchestration-design-*.md   # Phase 3
    ├── sprint-plan-*.md            # Phase 4
    ├── *-implementation/           # Phase 4 (generated YAML + SQL)
    ├── review-*.md                 # Phase 4 (adversarial review report)
    └── retrospective-epic-*.md     # Phase 4 (end-of-epic retro)
```

Artifacts produced by step-file workflows (`pipeline-spec-*.md`, `review-*.md`, `retrospective-epic-*.md`) carry a `stepsCompleted: [...]` list in their frontmatter so the workflow can resume across sessions.

## Agent Personas

Talk to a specialized agent for guided assistance. Each agent coordinates multiple workflow skills and brings domain expertise:

| Skill | Agent | Specialty |
|---|---|---|
| `starflow-data-analyst` | **Lea** | Domain discovery, source analysis, business requirements |
| `starflow-data-architect` | **Winston** | Architecture, schemas, pipeline design, Starlake configuration |
| `starflow-data-engineer` | **Amelia** | ETL pipeline development, SQL transformations, orchestration |
| `starflow-data-quality-engineer` | **Quinn** | Expectations framework, data profiling, privacy compliance |
| `starflow-platform-engineer` | **Max** | Infrastructure, orchestration deployment, CI/CD |

```
You: /starflow-data-architect Design a data platform for our e-commerce analytics
```

## How Starflow Works

### Step-File Workflows

The heavier workflows (`starflow-create-pipeline-spec`, `starflow-code-review`, and `starflow-retrospective`) use a **step-file architecture**. Each step lives in its own `steps/step-NN-*.md` file with explicit halt-for-input checkpoints, and progress persists in a `stepsCompleted: [...]` list in the output document's frontmatter. A workflow can therefore resume cleanly across sessions or context windows: rerun the skill on the same output file and it picks up at the next uncompleted step.

### Adversarial Parallel Code Review

`starflow-code-review` spawns three independent persona subagents in parallel: **Winston** (architecture), **Amelia** (engineering), and **Quinn** (data quality). Each has a focused prompt and the same code under review. Findings are then deduplicated and triaged into BLOCKER / WARNING / SUGGESTION / APPROVED. The independence is the point: each reviewer applies a different lens, surfacing issues a single-pass review would miss.

### Adaptive Help

`starflow-help` is more than a menu. It reads the skill manifest at `.agents/starflow/_config/starflow-help.csv` (with `phase`, `after`, `before`, `required`, `output-location`, and `outputs` columns) and scans your artifacts directory to detect which steps are already done. It then recommends the **next required skill** based on dependencies, not a hard-coded order, so it works whether you started with discovery or jumped in mid-stream.

```
You: /starflow-help What should I work on next?
```

### Layered Configuration

Starflow defaults are resolved from three layers (highest wins):

1. **Base**: `.agents/starflow/config/starflow.yaml` (installer-managed, treat as read-only)
2. **Team**: `.agents/starflow/config/custom/starflow.yaml` (committed to your repo)
3. **Personal**: `.agents/starflow/config/custom/starflow.user.yaml` (gitignored)

The same model applies to each skill's `customize.yaml`. Skills resolve config at runtime via `python3 .agents/starflow/scripts/resolve_config.py --starflow-root <path>`, which deep-merges mappings and merges sequences of mappings by their `code` or `id` key, so a team can override a single agent's `description` without re-listing the others. See [`.agents/starflow/config/README.md`](https://github.com/starlake-ai/starlake-skills/blob/main/.agents/starflow/config/README.md) in the skills repo for full merge semantics.

For example, to set the team's default engine to Snowflake and tighten Winston's voice without re-declaring the other personas, drop this in `.agents/starflow/config/custom/starflow.yaml`:

```yaml
default_engine: snowflake
target_engines:
  - snowflake
  - bigquery

agents:
  - code: data-architect
    description: "Channels Kimball at the whiteboard. Always names a recommended option, never just trade-offs."
```

The `agents` list merges by `code`: only `data-architect` is touched; Lea, Amelia, Quinn, and Max keep their base values.

## Getting Started

1. Run `/starflow-help` to assess your project state and get recommendations
2. Begin with `/starflow-domain-discovery` to map your data landscape
3. Follow the phases in order, or jump to the phase you need
4. After shipping an epic, run `/starflow-retrospective` to capture lessons and check follow-through on the previous retro
5. Each Starflow skill references the relevant Starlake CLI skills for implementation details