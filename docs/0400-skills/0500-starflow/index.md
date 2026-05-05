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

Starflow is an optional guided methodology layer that helps you plan and implement data pipelines step-by-step. While Starlake Skills give you direct access to every CLI command, Starflow provides a structured workflow with specialized agent personas that guide you through the full lifecycle — from domain discovery to production deployment.

## When to Use Starflow

- **Greenfield projects** — Starting a new data platform from scratch
- **Complex migrations** — Moving from legacy ETL to Starlake
- **Team onboarding** — Structured approach for teams new to Starlake
- **Architecture reviews** — Systematic evaluation of existing pipelines

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
  │          │
  │          ▼
  │     Quality Review + Retrospective
  │          │
  └──────────┘
       iterate
```

### Phase 1: Discovery

Map your data landscape before writing any configuration.

| Skill | Description |
|---|---|
| `starflow-domain-discovery` | Identify and document data domains, sources, and ownership |
| `starflow-source-analysis` | Deep-dive into source schemas, quality, volume, and extraction strategies |

### Phase 2: Architecture

Design the platform and schemas that will support your pipelines.

| Skill | Description |
|---|---|
| `starflow-create-data-architecture` | Design layers (raw, staging, mart), engines, storage, and governance |
| `starflow-schema-design` | Design Starlake-compatible table schemas with types, constraints, privacy, and expectations |

### Phase 3: Pipeline Design

Specify pipelines end-to-end before implementation.

| Skill | Description |
|---|---|
| `starflow-create-pipeline-spec` | Create complete pipeline specifications covering extract, load, transform, and orchestrate |
| `starflow-transform-design` | Design SQL transformations with quality checks and dependency management |
| `starflow-orchestration-design` | Design DAGs, schedules, and retry/timeout policies for pipeline execution |

### Phase 4: Implementation

Build, test, deploy, and reflect on your pipelines.

| Skill | Description |
|---|---|
| `starflow-sprint-planning` | Break down pipeline work into sprint-sized tasks with dependency ordering |
| `starflow-dev-pipeline` | Generate Starlake configuration files (YAML + SQL) from specifications |
| `starflow-code-review` | Adversarial parallel review (Winston + Amelia + Quinn) before deployment |
| `starflow-retrospective` | End-of-epic retrospective that checks follow-through on the previous retro's action items |

### Quality Review

Cross-cutting skills for validating pipelines at any phase.

| Skill | Description |
|---|---|
| `starflow-data-quality-review` | Review expectations coverage and identify gaps across pipelines |
| `starflow-lineage-review` | Trace and document data lineage across pipeline stages |

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

The heavier workflows — `starflow-create-pipeline-spec`, `starflow-code-review`, and `starflow-retrospective` — use a **step-file architecture**. Each step lives in its own `steps/step-NN-*.md` file with explicit halt-for-input checkpoints, and progress persists in a `stepsCompleted: [...]` list in the output document's frontmatter. A workflow can therefore resume cleanly across sessions or context windows: rerun the skill on the same output file and it picks up at the next uncompleted step.

### Adversarial Parallel Code Review

`starflow-code-review` spawns three independent persona subagents in parallel — **Winston** (architecture), **Amelia** (engineering), **Quinn** (data quality) — each with a focused prompt and the same code under review. Findings are then deduplicated and triaged into BLOCKER / WARNING / SUGGESTION / APPROVED. The independence is the point: each reviewer applies a different lens, surfacing issues a single-pass review would miss.

### Adaptive Help

`starflow-help` is more than a menu. It reads the skill manifest at `.agents/starflow/_config/starflow-help.csv` (with `phase`, `after`, `before`, `required`, `output-location`, and `outputs` columns) and scans your artifacts directory to detect which steps are already done. It then recommends the **next required skill** based on dependencies — not a hard-coded order — so it works whether you started with discovery or jumped in mid-stream.

```
You: /starflow-help What should I work on next?
```

### Layered Configuration

Starflow defaults are resolved from three layers (highest wins):

1. **Base** — `.agents/starflow/config/starflow.yaml` (installer-managed, treat as read-only)
2. **Team** — `.agents/starflow/config/custom/starflow.yaml` (committed to your repo)
3. **Personal** — `.agents/starflow/config/custom/starflow.user.yaml` (gitignored)

The same model applies to each skill's `customize.yaml`. Skills resolve config at runtime via `python3 .agents/starflow/scripts/resolve_config.py --starflow-root <path>`, which deep-merges mappings and merges sequences of mappings by their `code` or `id` key — so a team can override a single agent's `description` without re-listing the others. See [`.agents/starflow/config/README.md`](https://github.com/starlake-ai/starlake-skills/blob/main/.agents/starflow/config/README.md) in the skills repo for full merge semantics.

## Getting Started

1. Run `/starflow-help` to assess your project state and get recommendations
2. Begin with `/starflow-domain-discovery` to map your data landscape
3. Follow the phases in order, or jump to the phase you need
4. After shipping an epic, run `/starflow-retrospective` to capture lessons and check follow-through on the previous retro
5. Each Starflow skill references the relevant Starlake CLI skills for implementation details