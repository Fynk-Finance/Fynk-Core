---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: fix/inicio-illustration-dark
tool: Claude Code
pr: none
status: done
---

# Draw the Inicio illustration with the dark design colors

## Instruction

This is part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". Sofia's #15 had already moved the identity screens to `useTheme()`. The Inicio illustration still used only the light colors. Claude Code (Opus) planned and reviewed the work. A Sonnet subagent wrote it, and Claude Code ran the checks again itself.

## What was done

* **`ui/InicioIllustration.tsx`:**
  * The light and dark `Inicio.html` were compared element by element. Four fills differ:
    * the two backdrop squares (`#f4fbfe`/`#e4f5fc` → `#182a37`/`#1a3444`);
    * the card shadow (`#d2eef9` → `#1d3a4a`);
    * the blue card's second logo square (`#eef9fe` → `#182a37`).
  * These four now come from a small per-scheme palette, chosen with `useTheme().scheme`. Everything else is the same in both files and stays as it was.
  * Paths, geometry and the motion are unchanged.
* **`ui/InicioIllustration.test.tsx`:** renders in light and in dark, and checks that each scheme draws its own fills and not the other's.

## Result

* `make lint-mobile`, `make format-check` and `make test-mobile` pass (473 tests).
* Not checked on a phone. Toggle Mi cuenta › Apariencia › Oscuro and compare Inicio with `docs/design/screens/dark/Inicio.png`.

## Decisions and problems

* **The colors stay local to the screen,** as the design README says for illustrations. No new tokens.
* **The branch was renamed** from `refactor/identity-ui-theme` to `fix/inicio-illustration-dark`. The rest of that refactor had already landed in #15, so only a visual fix was left.

## Next step

The device libraries chore (`chore/add-device-libraries`).
