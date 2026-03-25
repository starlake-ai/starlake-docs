---
sidebar_position: 8
title: Security
description: Skills for access control, privacy, and data protection
---

# Security

2 skills for implementing row-level security, column-level security, IAM policies, and privacy transformations.

## Skills

### secure

**RLS, CLS, and privacy transformations.** Configure fine-grained access control and data masking rules.

```
You: /secure Set up row-level security on the customers table by region
```

**Capabilities:**
- **Row-Level Security (RLS)** — Restrict row access based on user attributes
- **Column-Level Security (CLS)** — Hide or mask columns per role
- **Privacy transformations** — Hash, encrypt, or anonymize sensitive data

### Privacy Transforms

| Transform | Description | Example |
|---|---|---|
| `SHA256` | SHA-256 hash | Email anonymization |
| `MD5` | MD5 hash | Legacy compatibility |
| `HIDE` | Replace with null | Remove sensitive columns |
| `INITIALS` | Keep first letter only | Name pseudonymization |
| `EMAIL` | Mask email domain | `user@*****.com` |
| `APPROX` | Round numeric values | Salary ranges |

### Configuration Example

```yaml
# In table definition
table:
  name: customers
  attributes:
    - name: email
      type: string
      privacy: SHA256
    - name: phone
      type: string
      privacy: HIDE
    - name: salary
      type: decimal
      privacy: APPROX
    - name: name
      type: string
      privacy: INITIALS
```

---

### iam-policies

**IAM policy management.** Configure identity and access management policies for your data platform.

```
You: /iam-policies Set up IAM policies for the analytics team with read-only access to production
```

**Features:**
- Role-based access control definitions
- Policy inheritance across domains
- Integration with cloud IAM (BigQuery, Snowflake)
- Audit logging for access changes
