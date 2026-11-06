---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: docs/simulated-banks-adr
tool: Claude Code
pr: none
status: done
---

# ADR 0008 for the simulated banks and the CLAUDE.md updates

## Instruction

Daniel approved the simulated banks plan and asked to start the stack with step 1, the ADR and the CLAUDE.md updates.

## What was done

- Added `docs/adr/0008-simulated-bank-provisioning.md`: context, decision, why it is a demo-only exception to rule 8, consequences and alternatives.
- `CLAUDE.md`: one sentence in rule 8, a note in "Where data lives", the "Simulated bank" decision row changed, a new "Simulated banks (6 Nov)" row, the M16b mention in "Plan and prompts", and Daniel's modules and points (39 to 54) in the Team table.
- `docs/modules/M16-banco-demo.md`: a note under the HU-047 criterion about accounts at consent. The old text stays.

## Result

- Tests: none, documentation only. Prettier check passes on the changed files.
- Pull request: not opened yet.
- The ADR and the shared file updates are ready for review by the module owners.

## Decisions and problems

- Decision: accounts are created at sign up for the demo only, with only the Keycloak `sub` sent. The reasons are in the ADR.
- No problems found.

## Next step

Open the pull request for this branch, then start step 2: `feature/simulated-banks-contract`.
