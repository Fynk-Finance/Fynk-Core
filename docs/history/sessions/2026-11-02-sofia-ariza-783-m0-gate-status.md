---
date: 2026-11-02
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: docs/gate-checklist-status
tool: Claude Code
pr: "#225"
status: done
---

# Check Gates A and B on an Android phone and record their status

## Instruction

Sofia ran the app on a real Android phone against the local stack to "check as much gates as possible", reported what she saw, and asked for "a pr who ticks which gates are already complete (or its requirements)".

## What was done

* `docs/modules/00-phases-and-gates.md`: ticked the checklist items that were verified and added a dated status under the Gate A and Gate B checklists, with what blocks each open item.
* Checks run in this session, beyond Sofia's own tests on the phone:
  * the vault file copied from the phone with `adb exec-out run-as` cannot be opened with `sqlite3` ("file is not a database");
  * `audit.events` has rows for login, device and consent, and `update` and `delete` fail with the append-only error;
  * CI passes on the latest pull requests to `develop`; staging (`api.fynk.club`) does not resolve and the Deploy Staging workflow fails on `develop`.

## Result

* Ticked: Gate A `make dev` under 10 minutes, Gate A CI, Gate B sign up and sign in, Gate B vault encryption and unlock (password and fingerprint).
* Pull request: #225.

## Decisions and problems

* An item is ticked only when everything in its line was seen working. Partial results (Android without iOS, audit rows without link and sync) stay unticked, with a note.
* Everything was checked on the local stack, not on staging, because staging is down. The status notes say so.
* Fingerprint unlock looked broken at first: the app opened without asking. That is the design: a login of the last 5 minutes opens the vault, and the app locks after 5 minutes in the background.
* Found SCRUM-72: every backup flow answers 500 because the audit allow-list of M13 rejects the events of M2. It blocks the second phone checks of Gate B.
* Open findings from the phone, not filed yet: no slide animation on tab changes and pushed screens; the Aviso illustration of onboarding looks clipped in one corner; Android's white contrast layer over the three-button navigation bar.

## Next step

Fix the navigation bar contrast (M0), get a screen recording of the missing animation and a screenshot of the Aviso illustration, and repeat the Gate B second phone checks once SCRUM-72 is merged.
