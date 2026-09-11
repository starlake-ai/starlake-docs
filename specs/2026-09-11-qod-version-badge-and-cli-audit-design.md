# QoD version badge + CLI docs completeness audit

Date: 2026-09-11
Status: approved design, pending implementation

## Goals

1. Display the QoD (Quack on Demand) version on the docs site, scoped to `/qod` pages.
2. Ensure the QoD CLI docs cover every `qod` command and every option, as of the v0.8.3 release.

## Part 1: Version badge

### Spec refresh (prerequisite)

The committed `static/openapi.yaml` says `0.5.3-SNAPSHOT`; QoD's latest release is v0.8.3.

- Create a temporary git worktree of `~/git/public/quack-on-demand` at tag `v0.8.3`.
- Run `sbt genOpenApi` in that worktree; copy the generated `website/static/openapi.yaml` over `static/openapi.yaml` in this repo.
- Remove the worktree only after Part 2 is done (it is also the CLI ground truth).

The spec then reports `version: 0.8.3` and the `/api/` Redoc page matches the released API. Refreshing `openapi.yaml` on each QoD release updates both the API reference and the badge in one move.

### Version sourcing

- `docusaurus.config.js` reads `static/openapi.yaml` synchronously at config-load time and extracts the `version:` value from the `info:` block with a small regex (no yaml dependency).
- The value is exposed as `customFields.qodVersion`.
- If the file is missing or the pattern does not match, `qodVersion` is `null`, the badge does not render, and the build never fails because of it.

### Navbar item

- Add `{ type: "custom-qodVersion", position: "left" }` right after the "Quack on Demand" navbar link (non-blog site only).
- `src/theme/NavbarItem/ComponentTypes.js` maps `custom-qodVersion` to `src/components/QodVersionBadge`.
- The component uses `useLocation()` and `useDocusaurusContext()`; it returns `null` unless the pathname starts with `/qod` and `qodVersion` is set.
- When shown, it renders `v0.8.3` as a small rounded pill linking to `pathname:///api/`, styled via a CSS module with theme-aware colors (light and dark).

### Testing

- `yarn build` passes in both normal and `IS_BLOG=1` modes.
- Visual check with `yarn start`: badge visible on `/qod` pages, absent on `/starflow`, `/docs`, and the landing page.

## Part 2: CLI docs completeness audit

### Ground truth

The CLI is the Python package at `cli/src/qod_cli` in the quack-on-demand repo (command modules under `commands/`). Ground truth is a recursive `--help` walk of the CLI **from the v0.8.3 worktree** (not the installed binary, which is 0.8.2):

- Enumerate every top-level command, every subcommand, and for each: its options/flags, argument names, and defaults as printed by `--help`.
- Save the walk output to a scratch file as the checklist.

### Docs to audit

- `qod/cli/index.md`, `qod/cli/admin.md`, `qod/cli/sql.md`, `qod/cli/reference.md`
- `qod/reference/cli.md`

### Method

- Diff the help-walk checklist against the docs: every command must appear in the reference page(s); every option must be documented where its command is described.
- Fix gaps by updating the docs pages, following their existing structure and tone (reference tables in `reference.md`, prose in the topic pages).
- Commands intentionally undocumented (if any, e.g. internal/hidden ones not shown in `--help`) are out of scope by construction, since `--help` output is the source of truth.
- Also correct any documented option that no longer exists or whose default changed.

### Testing

- `yarn build` passes (Docusaurus link checking is the dead-link gate).
- A final re-diff of the checklist against the updated docs shows zero missing commands and zero missing options.

## Out of scope

- Automating the spec refresh in CI (future QoD release-process work).
- Versioned docs (docusaurus version dropdown); only the current release is shown.
