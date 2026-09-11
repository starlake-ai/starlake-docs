# QoD Version Badge + CLI Docs Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the released QoD version as a navbar badge on `/qod` pages, and make the QoD CLI docs cover every `qod` command and option as of v0.8.3.

**Architecture:** `static/openapi.yaml` (regenerated from the v0.8.3 tag) is the single version source; `docusaurus.config.js` extracts `info.version` into `customFields.qodVersion`; a custom navbar item component renders the badge only on `/qod` routes. The CLI audit uses a click-introspection walk of the v0.8.3 Typer app as ground truth, diffed against the five QoD CLI docs pages.

**Tech Stack:** Docusaurus 3.9.2 (React, CSS modules), sbt (`genOpenApi` in quack-on-demand), Python/uv (qod CLI is a Typer app).

## Global Constraints

- Never use the em dash character in any written prose (user rule).
- QoD source repo: `/Users/hayssams/git/public/quack-on-demand`; release tag `v0.8.3`.
- Docs repo: `/Users/hayssams/git/public/starlake-docs`, branch `main`; commit per task, do NOT push (user pushes on request).
- Scratch dir: `/private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad`.
- The badge must never break the build: missing or unparsable spec means no badge, not an error.
- Docs edits follow the existing structure and tone of each page (tables in reference pages, prose in topic pages).

---

### Task 1: Regenerate openapi.yaml from the v0.8.3 tag

**Files:**
- Modify: `static/openapi.yaml` (full overwrite with generated content)

**Interfaces:**
- Produces: `static/openapi.yaml` whose `info:` block contains `version: 0.8.3`. Task 2 reads it; Task 4 reuses the worktree created here.

- [ ] **Step 1: Create a v0.8.3 worktree of quack-on-demand**

```bash
git -C /Users/hayssams/git/public/quack-on-demand worktree add /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-0.8.3 v0.8.3
```

Expected: `Preparing worktree (detached HEAD ...)`.

- [ ] **Step 2: Generate the spec**

```bash
cd /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-0.8.3 && sbt genOpenApi
```

Expected: exits 0 and writes `website/static/openapi.yaml` in the worktree. This can take several minutes (sbt startup + compile). If `genOpenApi` is not a valid key at that tag, run `sbt tasks -V | grep -i openapi` to find the actual task name.

- [ ] **Step 3: Verify version, then copy over the docs-repo spec**

```bash
grep -m1 "  version:" /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-0.8.3/website/static/openapi.yaml
cp /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-0.8.3/website/static/openapi.yaml /Users/hayssams/git/public/starlake-docs/static/openapi.yaml
```

Expected: `  version: 0.8.3`. If it prints `0.8.4-SNAPSHOT`, the tag checkout failed; stop and re-check Step 1 (version.sbt at the tag must say 0.8.3, non-SNAPSHOT; if the tag itself carries a SNAPSHOT version, keep the file but note the displayed version will match version.sbt at the tag).

- [ ] **Step 4: Commit**

```bash
cd /Users/hayssams/git/public/starlake-docs && git add static/openapi.yaml && git commit -m "docs(qod): refresh openapi.yaml from v0.8.3 (was 0.5.3-SNAPSHOT)"
```

Do NOT remove the worktree yet; Task 4 uses it.

---

### Task 2: Expose qodVersion from docusaurus.config.js

**Files:**
- Modify: `docusaurus.config.js` (top of file, after existing requires around line 6; and the `customFields` block around line 272)

**Interfaces:**
- Produces: `siteConfig.customFields.qodVersion` (string like `"0.8.3"`, or `null` when unreadable). Task 3's component consumes it.

- [ ] **Step 1: Add the version reader after the existing requires**

Insert after the `const {GlobExcludeDefault} = require('@docusaurus/utils');` line:

```js
const fs = require("fs");
const path = require("path");

// QoD version shown in the navbar badge; sourced from the generated OpenAPI
// spec so the badge and the /api/ reference can never disagree.
function readQodVersion() {
  try {
    const spec = fs.readFileSync(path.join(__dirname, "static", "openapi.yaml"), "utf8");
    const m = spec.match(/^\s+version:\s*(\S+)\s*$/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
const qodVersion = readQodVersion();
```

- [ ] **Step 2: Add the field to customFields**

In the existing `customFields` object (the one containing `qodGaId`), add:

```js
    qodVersion,
```

- [ ] **Step 3: Verify the value resolves**

```bash
cd /Users/hayssams/git/public/starlake-docs && node -e "const c=require('./docusaurus.config.js'); console.log(JSON.stringify(c.customFields.qodVersion))"
```

Expected: `"0.8.3"`. (If the config exports a promise/function form, adapt: `Promise.resolve(typeof c==='function'?c():c).then(x=>console.log(x.customFields.qodVersion))`.)

- [ ] **Step 4: Verify the fallback path**

```bash
cd /Users/hayssams/git/public/starlake-docs && mv static/openapi.yaml /tmp/openapi.yaml.bak && node -e "const c=require('./docusaurus.config.js'); console.log(JSON.stringify(c.customFields.qodVersion))"; mv /tmp/openapi.yaml.bak static/openapi.yaml
```

Expected: `null`, no exception, and the spec file restored afterwards.

- [ ] **Step 5: Commit**

```bash
git add docusaurus.config.js && git commit -m "feat(qod): expose qodVersion from openapi.yaml via customFields"
```

---

### Task 3: Navbar badge component

**Files:**
- Create: `src/components/QodVersionBadge/index.js`
- Create: `src/components/QodVersionBadge/styles.module.css`
- Create: `src/theme/NavbarItem/ComponentTypes.js`
- Modify: `docusaurus.config.js` (navbar `items`, right after the "Quack on Demand" entry around line 105-109)

**Interfaces:**
- Consumes: `customFields.qodVersion` from Task 2.
- Produces: navbar item type `custom-qodVersion`.

- [ ] **Step 1: Create the component**

`src/components/QodVersionBadge/index.js`:

```js
import React from "react";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./styles.module.css";

// Navbar item (type: "custom-qodVersion") showing the QoD release version,
// only while browsing /qod pages. Renders nothing when the version is
// unknown so a missing openapi.yaml never breaks the navbar.
export default function QodVersionBadge() {
  const { pathname } = useLocation();
  const { siteConfig } = useDocusaurusContext();
  const version = siteConfig.customFields?.qodVersion;
  if (!version || !pathname.startsWith("/qod")) {
    return null;
  }
  return (
    <Link
      to="pathname:///api/"
      className={styles.badge}
      title="Quack on Demand REST API reference"
    >
      v{version}
    </Link>
  );
}
```

- [ ] **Step 2: Create the styles**

`src/components/QodVersionBadge/styles.module.css`:

```css
.badge {
  align-self: center;
  margin-left: -0.5rem;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--ifm-color-primary-darkest);
  background: var(--ifm-color-emphasis-200);
}

.badge:hover {
  text-decoration: none;
  background: var(--ifm-color-emphasis-300);
  color: var(--ifm-color-primary-darkest);
}

[data-theme="dark"] .badge,
[data-theme="dark"] .badge:hover {
  color: var(--ifm-color-primary-lightest);
}
```

- [ ] **Step 3: Register the navbar item type**

`src/theme/NavbarItem/ComponentTypes.js`:

```js
import ComponentTypes from "@theme-original/NavbarItem/ComponentTypes";
import QodVersionBadge from "@site/src/components/QodVersionBadge";

export default {
  ...ComponentTypes,
  "custom-qodVersion": QodVersionBadge,
};
```

- [ ] **Step 4: Add the navbar entry**

In `docusaurus.config.js`, right after the existing block

```js
        !isBlog ? {
          to: "/qod",
          label: "Quack on Demand",
          position: "left",
        } : null,
```

add (same null-when-blog pattern):

```js
        !isBlog ? {
          type: "custom-qodVersion",
          position: "left",
        } : null,
```

Note: the config already emits `null` items; if `yarn build` rejects null navbar items, mirror however the existing nulls are stripped (check for a `.filter(Boolean)` on the items array and add one if the existing pattern relies on it).

- [ ] **Step 5: Build both site modes**

```bash
cd /Users/hayssams/git/public/starlake-docs && yarn build && IS_BLOG=true yarn build
```

Expected: both succeed.

- [ ] **Step 6: Verify SSG output**

```bash
grep -o "v0\.8\.3" build/qod/index.html | head -1
grep -c "v0\.8\.3" build/index.html build/starflow/index.html || true
```

Expected: first prints `v0.8.3` (badge present on the QoD page); second prints `0` for both non-QoD pages. (Run the greps against the non-blog build; rebuild with plain `yarn build` if the blog build overwrote `build/`.)

- [ ] **Step 7: Visual check**

Run `yarn start`, open `/qod`, confirm the pill next to "Quack on Demand" in light and dark themes, click it to reach `/api/`, then navigate to `/starflow` and confirm it disappears. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/components/QodVersionBadge src/theme/NavbarItem docusaurus.config.js && git commit -m "feat(qod): navbar version badge on /qod pages"
```

---

### Task 4: CLI ground truth from v0.8.3

**Files:**
- Create (scratch, not committed): `<scratchpad>/walk_cli.py`, `<scratchpad>/qod-cli-checklist.txt`

**Interfaces:**
- Consumes: the worktree from Task 1.
- Produces: `qod-cli-checklist.txt`, one line per command: `qod <path...> :: <opt>[/alias] [default: X]; <ARG>; ...`. Task 5 audits against it.

- [ ] **Step 1: Write the introspection script**

`<scratchpad>/walk_cli.py`:

```python
import click
from typer.main import get_command
from qod_cli.main import app


def fmt_param(p):
    if isinstance(p, click.Option):
        s = "/".join(p.opts + p.secondary_opts)
        if p.default not in (None, False) and not p.is_flag:
            s += f" [default: {p.default}]"
        if p.required:
            s += " [required]"
        return s
    return f"<{p.name.upper()}>"


def walk(cmd, path):
    if isinstance(cmd, click.Group):
        # Group-level options (e.g. --profile/--json on the root) still apply.
        opts = [fmt_param(p) for p in cmd.params if p.name != "help"]
        if opts:
            print(" ".join(path) + " :: " + "; ".join(opts))
        for name, sub in sorted(cmd.commands.items()):
            if sub.hidden:
                continue
            walk(sub, path + [name])
    else:
        params = [fmt_param(p) for p in cmd.params if p.name != "help"]
        print(" ".join(path) + " :: " + "; ".join(params))


walk(get_command(app), ["qod"])
```

- [ ] **Step 2: Run it against the v0.8.3 CLI**

```bash
cd /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-0.8.3/cli && uv run python /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/walk_cli.py > /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-cli-checklist.txt && wc -l /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-cli-checklist.txt
```

Expected: exits 0; checklist has one line per command (expect roughly 50-150 lines given 25+ command modules). Spot-check: `grep "qod tenant create" <checklist>` shows its options.

- [ ] **Step 3: Sanity-check against the live binary**

```bash
qod --help >/dev/null 2>&1 && qod tenant --help 2>&1 | head -20
```

Expected: subcommand names for `tenant` match the checklist lines (the installed 0.8.2 may lack a few 0.8.3 additions; the checklist wins).

---

### Task 5: Audit and update the CLI docs

**Files:**
- Modify (as gaps dictate): `qod/cli/index.md`, `qod/cli/admin.md`, `qod/cli/sql.md`, `qod/cli/reference.md`, `qod/reference/cli.md`

**Interfaces:**
- Consumes: `qod-cli-checklist.txt` from Task 4.

- [ ] **Step 1: Mechanical command coverage scan**

```bash
cd /Users/hayssams/git/public/starlake-docs && while IFS= read -r line; do cmd="${line%% ::*}"; grep -rqF "$cmd" qod/ || echo "MISSING COMMAND: $cmd"; done < /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-cli-checklist.txt
```

Expected: a (possibly empty) list of undocumented commands. Save the output.

- [ ] **Step 2: Option-level audit, command group by command group**

For each command group in the checklist (auth, catalog, config, database, demo, federation, group, maintenance, manifest, membership, node, pool, profile, role, setup, skill, sql, start, status, stop, tag, telemetry, tenant, user, plus root-level options and bare commands like health/ready): read the docs page that covers it (find it with `grep -rl "qod <group>" qod/`) and compare its documented options against the checklist line. Record three kinds of findings: missing command, missing or wrong option (including wrong defaults), documented option that no longer exists.

- [ ] **Step 3: Apply the docs edits**

Fix every finding in the page where the command is documented, following that page's existing format: `qod/cli/reference.md` and `qod/reference/cli.md` hold the exhaustive tables (add rows there for every missing command and option), while `qod/cli/admin.md` and `qod/cli/sql.md` get prose or examples only where a new command materially changes the workflow they describe. Do not invent behavior: the checklist text (option names, defaults, required flags) is the only source; where a new command needs a description line, derive it from the command's `--help` short help (`cd <worktree>/cli && uv run qod <group> <cmd> --help`).

- [ ] **Step 4: Re-run the coverage scan until clean**

Re-run Step 1's loop. Expected: no `MISSING COMMAND` lines. Then re-check each edited page against its checklist lines for option completeness.

- [ ] **Step 5: Build gate**

```bash
yarn build
```

Expected: passes (`onBrokenLinks: throw` is the dead-link gate).

- [ ] **Step 6: Commit**

```bash
git add qod/ && git commit -m "docs(qod): CLI reference covers all v0.8.3 commands and options"
```

---

### Task 6: Cleanup

- [ ] **Step 1: Remove the worktree**

```bash
git -C /Users/hayssams/git/public/quack-on-demand worktree remove /private/tmp/claude-501/-Users-hayssams-git-public-starlake-docs/fc8dc047-c6d7-45ba-ab41-65bc787d1a61/scratchpad/qod-0.8.3 --force
```

- [ ] **Step 2: Final verification**

```bash
cd /Users/hayssams/git/public/starlake-docs && yarn build && git log --oneline -6 && git status --short
```

Expected: build passes; commits from Tasks 1, 2, 3, 5 present; working tree clean (scratch files live outside the repo). Report to the user; push only when asked.
