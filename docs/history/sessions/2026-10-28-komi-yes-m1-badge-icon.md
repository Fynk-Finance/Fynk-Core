---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: chore/badge-icon
tool: Claude Code
pr: none
status: done
---

# Let the shared Badge draw the "Perfil verificado" pill

## Instruction

Part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". Mi cuenta (`DetalleCuentas`) shows a "Perfil verificado" pill with a check icon at 11 px. The shared `Badge` had no icon and only sizes 9 and 10. M1 must not draw its own style, so the shared component grows (M0 reviews). Claude Code (Opus) planned and reviewed the work. A Sonnet subagent wrote it, and Claude Code ran the checks again itself.

## What was done

* **`shared/ui/components/Badge.tsx`:**
  * `size: 'lg'` (11/14 px, padding 4 and 8, from the design);
  * an optional `icon`, drawn before the label at 12 px, in the badge's foreground color, stroke 3.2, gap 4.

  Existing variants keep the same styles, and their snapshots are unchanged.
* **Colors and icon:** the existing `accent` tone is the design's color in both themes (`#a8e03a` with white text, the same in the dark file). The `check` icon already had the design's path.
* **Catalog:** a new `WithIcon` story, with its light and dark snapshots.
* **`components.test.tsx`:** `lg` is 11 px, the icon uses the foreground color and stroke 3.2, and there is no icon by default.

## Result

* `make lint-mobile`, `make test-mobile` (476 tests, 118 snapshots) and `make format-check` pass.

## Decisions and problems

* **No new tone and no new icon.** Both already matched the design.

## Next step

`feature/mi-cuenta-screen` uses `<Badge tone="accent" size="lg" icon="check" label="Perfil verificado" />`.
