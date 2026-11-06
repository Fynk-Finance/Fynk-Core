---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73, SCRUM-74, SCRUM-75, SCRUM-64]
branch: docs/simulated-banks-prompt
tool: Claude Code
pr: none
status: done
---

# Plan the simulated banks: random accounts in several fictional entities at sign-up

## Instruction

Daniel asked for an audit of which modules are left. In reviewing it, he said Banco Demo "is supposed to be a simple simulator", so its portal login, roles and theme are not missing work. What is missing is that a new Fynk user gets "random bank accounts in different banks (just one per bank unless is realistic to have more than one ...) with random balances not negative", created "when the user does the first part of the sign up in fynk so when they get to the connection section it shows the banks". Bancolombia stays the only real bank and waits for Juan Carlos. Daniel takes this work himself, M5 pieces included (option A), and Juan Pablo (M16) and Juan Carlos (M5) review their folders.

## What was done

* Jira: created SCRUM-73 (HU-056), SCRUM-74 (HU-057) and SCRUM-75 (HU-058) in Spanish under SCRUM-12, 5 points each, assigned to Daniel. Edited the SCRUM-64 criterion that said accounts are created at consent, so it now points to SCRUM-73.
* `docs/modules/M16b-simulated-banks.md`: the module prompt, with the stories and criteria, the four fictional entities and their probabilities, the balance ranges, the generator rules, the simulator endpoints, "Ingresar con Fynk" in both realms, the Fynk changes in M1 and M5, a 7-branch stack, the tests and the "ask before" list.

## Result

* No code changed, so no tests ran.
* Pull request: this branch is the bottom of the stack.

## Decisions and problems

* The team agreed on 6 Nov 2026: several fictional entities, accounts created at the first part of sign-up instead of at consent, cards with a random debt below their limit, and only the Keycloak `sub` sent to the simulator. It is an exception to rule 8 for the demo only, to be recorded in ADR 0008.
* Checking `develop` again found gaps the prompt did not list, which the plan adds to the stack:
  * the simulator's Open Finance API maps every Fynk token to the demo consent;
  * revoke and refresh parse the token wrongly;
  * both listeners serve the same routes;
  * the `client_credentials` grant ignores the scope.
* Flagged to Juan Pablo, not fixed here: the simulator's client assertion check accepts RS256 and does not verify the signature.

## Next step

Step 1 of the stack: ADR 0008, with the `CLAUDE.md` and M16 prompt updates.
