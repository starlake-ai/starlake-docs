---
sidebar_position: 6
title: Lineage & Dependencies
description: Skills for tracking data lineage and dependencies
---

# Lineage & Dependencies

4 skills for understanding data flow through your pipelines — from column-level tracing to access control dependencies.

## Skills

### lineage

**Data lineage visualization.** Generate visual lineage diagrams showing how data flows between domains and tables.

```
You: /lineage Show me the full data lineage for the analytics domain
```

---

### col-lineage

**Column-level lineage tracking.** Trace individual columns through joins, CTEs, subqueries, and transformations to their source data.

```
You: /col-lineage Trace the total_revenue column back to its source tables
```

**Key capabilities:**
- Traces columns through complex SQL (joins, CTEs, subqueries, window functions)
- Cross-domain lineage tracking
- Impact analysis for schema changes
- Visual dependency graphs

---

### table-dependencies

**Table dependency analysis.** Map relationships between tables across load and transform operations.

```
You: /table-dependencies Show all tables that depend on the customers table
```

**Use cases:**
- Impact analysis before schema changes
- Identifying critical path tables
- Optimizing refresh order
- Understanding downstream effects

---

### acl-dependencies

**Access control lineage.** Track how access control policies propagate through your data pipeline.

```
You: /acl-dependencies Show which downstream tables inherit security policies from customers
```

## Lineage Visualization

Starlake generates lineage diagrams in multiple formats:

```
You: /lineage Generate a lineage diagram for the entire project as SVG
```

The lineage output shows:
- **Source tables** (ingestion layer)
- **Intermediate tables** (staging transforms)
- **Target tables** (business layer)
- **Column mappings** between each layer
- **Access control inheritance**
