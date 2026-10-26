---
date: 2026-10-26
developer: Daniel Palacios
github: Komi-yes
module: planning
jira: []
branch: none
tool: claude.ai
pr: none
status: done
---

# Design handoff, team split and project history log

## Instruction

Make the design usable by Claude Code ("in the design there is mentioned some images that currently doesnt exist"), explain how to hand off screens with their animations and vector figures, say which modules cover data security and biometrics and which cover the general app, dashboard and onboarding, and add a project history. Key sentence: "make a log of what was instructed and what was the result so at the end we can give a project history on how was the project done and what was done in each session of each developer and each module".

## What was done

* Read the team's own copy of the design and saved the code of the 28 screens in `docs/design/source/`, with 25 PNGs in `docs/design/screens/`.
* Rewrote `docs/design/README.md` with the tokens, the conversion from HTML, SVG and CSS animations to React Native, and the screen inventory.
* Proposed the team split: security (M1, M2), general app, dashboard and onboarding (M0, M3, M6, M7), and four groups for the other modules.
* Added the project history log: rules in CLAUDE.md, `docs/history/`, the session template, `scripts/build-history.mjs`, a pull request checklist item and a CI check in M0.

## Result

* Developer kit with design code, images and history log, ready to copy into the repository root.

## Decisions and problems

* One file per session instead of one shared log, so the history never causes merge conflicts.
* The 6 Fynk Plus screens in the design are not in Jira. Left as an open item.

## Next step

M0 creates the repository with the kit in `chore/monorepo-skeleton`. Assign the modules and fill CODEOWNERS with the GitHub users.
