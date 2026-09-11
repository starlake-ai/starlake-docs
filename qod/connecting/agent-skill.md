---
id: agent-skill
title: Operator skill (AI agents)
---

Quack on Demand ships its operator runbook as an agent skill: a `SKILL.md` playbook that coding agents such as Claude Code, GitHub Copilot, and Gemini CLI load on demand and follow. With the skill installed, asking your agent "create a pool for tenant acme" or "why is auth failing" makes it drive a live manager through the [`qod` CLI](/qod/cli/) with the project's own recipes: boot and stop (`qod start` / `qod stop`), tenant, database, and pool lifecycle, RBAC grants and row/column policies, node health and telemetry, ad-hoc SQL through `qod sql`, and the known failure modes with their fixes.

The skill is self-contained: it assumes only an installed `qod` CLI (it checks the version, installs or upgrades it when needed, and logs in before operating), never a source checkout.

It complements the [MCP server](/qod/connecting/mcp): MCP gives an agent authenticated tools on the manager itself (schema discovery, governed SQL, pool operations over `/mcp`), while the skill gives it the operational playbook for the CLI. They work independently and combine well.

## Install with the CLI

The `qod` wheel bundles the skill; one command copies it where your agent tooling discovers skills:

```bash
qod skill install
# Install the skill for which LLM? (claude, copilot, gemini, all) [claude]:
```

The prompt picks the target platform; each installs into that platform's per-user skills directory:

| Answer | Target |
|---|---|
| `claude` (default) | `~/.claude/skills/quack-on-demand/` (Claude Code) |
| `copilot` | `~/.copilot/skills/quack-on-demand/` (GitHub Copilot) |
| `gemini` | `~/.gemini/skills/quack-on-demand/` (Gemini CLI) |
| `all` | All three |

Flags for scripted installs and other targets:

- `--platform claude|copilot|gemini|all` skips the prompt (repeatable, or comma-separated: `--platform claude,gemini`). A non-interactive run with no flag defaults to `claude`, so pipelines never hang on the prompt.
- `--project` installs into `./.{platform}/skills` of the current directory instead, scoping the skill to one project.
- `--dir <path>` names an exact skills directory and bypasses the platform choice entirely.

New agent sessions pick the skill up automatically. Re-run `qod skill install` after upgrading the CLI to refresh the copy; `qod skill path` prints where the bundled skill lives inside the installed package. If the target already exists as a symlink (for example pointing into a git checkout), the install refuses rather than writing through it.

## Install as a Claude Code plugin

For Claude Code specifically, the same skill is also published as a plugin, which manages its own updates:

```
/plugin marketplace add starlake-ai/quack-on-demand
/plugin install quack-on-demand@quack-on-demand
```

Update later with `/plugin marketplace update quack-on-demand`. Pick one channel per machine: the plugin and a `qod skill install` copy would both offer the same skill.
