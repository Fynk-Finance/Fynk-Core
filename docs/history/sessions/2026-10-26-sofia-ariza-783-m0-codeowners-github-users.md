---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: chore/codeowners-github-users
tool: Claude Code
pr: #10
status: done
---

# M0: real GitHub users in CODEOWNERS and the plan

## Instruction

Sofia asked to "update the info of codeowners and plan using as reference the folder fynk developer kit (1)". This finishes the next step of the team assignment log: "replace the 6 CODEOWNERS placeholders with GitHub users".

## What was done

* **Compared the kit with the repository.** Every kit file is the same as the repository's, except `.github/CODEOWNERS`. In the kit it is older: all 6 owners are still placeholders.
* **Took the users from the Fynk-Finance organization.** Each person below was matched by their GitHub profile name or username:

| Person | GitHub | Status in the organization |
| --- | --- | --- |
| Daniel Palacios | `@Komi-yes` | member (profile name Daniel Palacios Moreno) |
| Sofia Nicolle Ariza | `@sofia-ariza-783` | member (already in CODEOWNERS) |
| Juan Carlos Leal | `@JuanLeal05` | member |
| Juan Pablo Contreras | `@juancontrerasp` | invitation pending |
| Karol | `@Karol2905` | invitation pending |
| Julián Castiblanco | `@JulCR34l` | invitation pending (profile name Julián Castiblanco) |

* **`.github/CODEOWNERS`:** the 5 remaining placeholders were replaced, and the header now lists each person with their user.
* **The plan:**
  * CLAUDE.md, Team: new GitHub column;
  * each module prompt (`docs/modules/M00` to `M16`): the Owner row now has the GitHub user;
  * `docs/developer-kit.md`: no longer says to replace placeholders.

## Result

* No `@owner-` placeholder is left in the repository, outside the untracked kit copy.
* Prettier passes on the changed docs.
* Pull request #10. CI passed in about 40 s. The mobile, Expo prebuild and Go jobs were skipped because no app or Go file changed: the first real proof of the path filters from step 6.

## Decisions and problems

* **Pending invitations.** Until a person accepts the organization invitation, GitHub marks their CODEOWNERS lines as an unknown owner and does not request their review. Nothing needs to change in the file after they accept.
* **Read-only kit copy.** The kit folder `fynk-developer-kit (1)/` was used only as a reference. It is untracked and was not changed.
* **The plan document on claude.ai** ("Fynk Implementation Plan by Modules") is not in the repository, so it was not changed here.

## Next step

* Juan Pablo, Karol and Julián accept the Fynk-Finance invitation.
* Sofia turns on "Require review from Code Owners" and the required check "CI passed" on `develop` and `main`.
