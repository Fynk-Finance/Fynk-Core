---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-24, SCRUM-44, SCRUM-45]
branch: docs/bancolombia-finding
tool: Claude Code
pr: none
status: done
---

# ADR 0003: what Bancolombia's Open Finance sandbox allows

## Instruction

Juan Carlos asked to finish M4 and M5 and to build the Bancolombia part with the API Market access he got: "the idea es to use the sandbox"; "create that part and tell what to do so that we can link that." For the customer document that Bancolombia's consent API requires, he chose to send only the sandbox's fictional customer from the settings.

## What was done

* `docs/adr/0003-bancolombia-sandbox.md`: what the sandbox offers, the answer to the spike (yes, delegated access with authorization code), six findings for production, the decision, and who does what to link it.

## Result

* Pull request: not opened yet.

## Decisions and problems

* Findings: the consent asks for the customer's ID document (rule 10), 90 days of history, no third-party revocation, manual onboarding with Colombian certificates, a sandbox of mocks, and docs that disagree on the token scope.
* It answers CLAUDE.md open item 2. Removing it from CLAUDE.md is left to the team.

## Next step

The team decides whether Fynk may ask for the document for Bancolombia only.
