# Fynk developer kit

Everything a developer needs to start a module with Claude Code. Copy everything in this kit into the root of the Fynk repository in M0's first pull request (`chore/monorepo-skeleton`). Nothing in it is optional: Claude Code reads `CLAUDE.md`, `.claude/` and `docs/` in every session, GitHub uses `.github/`, and `scripts/` builds the project history. This file lives in `docs/` so the repository root keeps its own `README.md`.

| File | What it is |
| --- | --- |
| `CLAUDE.md` | Rules Claude Code reads in every session: architecture, design source, data, security, Git workflow, conflict rules, decisions |
| `.claude/settings.json` | Limits for Claude Code: no force push, no push to `develop` or `main`, no merges, no `terraform apply`, asks before touching shared files |
| `.github/pull_request_template.md` | Checklist for every pull request |
| `.github/CODEOWNERS` | Folder to owner map, with the GitHub user of each person in CLAUDE.md, Team |
| `docs/modules/00-phases-and-gates.md` | Order of work, what runs in parallel, gate checklists |
| `docs/modules/00-shared-contracts.md` | Types, ports, endpoints and reference numbers every module builds on |
| `docs/modules/M00-...md` to `M16-...md` | One prompt per module, ready to paste into Claude Code |
| `docs/design/README.md` | Design source, light and dark tokens, navigation and gestures, screen inventory, decided copy changes, missing screens |
| `docs/design/sources/` | The design's own code for 36 screens, in `light/` and `dark/` (`<Screen>.html`). Claude Code reads it first |
| `docs/design/screens/` | 72 PNG images (`light/` and `dark/`) to compare the result with the design |
| `scripts/design-color-pairs.mjs` | Prints the dark value of every light color of the design |
| `docs/history/` | Project history: rules, session template and the first planning sessions |
| `scripts/build-history.mjs` | Joins the session logs into `docs/history/PROJECT_HISTORY.md` |

## How a developer starts

1. The design code is in `docs/design/sources/` and the images in `docs/design/screens/`, each with a `light/` and a `dark/` folder. Update them only when the design changes (see `docs/design/README.md`).
2. Pull `develop`, open Claude Code at the repository root.
3. Paste the prompt of your module (everything below the line in `docs/modules/MNN-*.md`), or write: "Read docs/modules/M08-savings.md and do step 1 of the work plan."
4. Claude Code creates the branch, writes the tests from the Jira criteria, implements, commits with the Jira key, rebases and opens the pull request to `develop`.
5. Before the last commit, Claude Code writes the session log in `docs/history/sessions/` (see CLAUDE.md, Project history log).
6. One work plan step per branch and per pull request.

## Order

Phase 0: M0 first (others wait for its first pull request), then M14 and M16 in parallel.
Phase 1: M1, M2, M5 and M13 (audit store) in parallel.
Phase 2: M4, M6, M7, M12.
Phase 3: M8, M9, M10, then M3.
Phase 4: M11, M13 (privacy), M15.
