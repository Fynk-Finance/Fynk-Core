---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-21, SCRUM-22]
branch: feature/consents-list-data
tool: Claude Code
pr: none
status: done
---

# List, read and revoke consents from the app, with the hooks for other modules (M4 step 4, part 1)

## Instruction

After the M5 pull requests were opened, the developer asked to do M4 step 4 while Daniel (M1, M2) could not be reached. Key sentence: "For M4 step 4 do the best you can to allow later the full integration with the other modules that would need to be connected." The work was split into three branches stacked on #131; this is the first.

## What was done

* **`domain/consentList.ts`**, pure:
  * `statusAt`: an active consent past its end shows as expired at once, using the clock;
  * `canRevoke`: only active or pending consents;
  * `shortDate`: "3 sep 2026" in Bogotá time;
  * `sortForList`: live consents first, newest first;
  * `entityName`: the provider's name, or its id when it is no longer listed.
* **`adapters/consentsApi.ts`:**
  * `GET /consents`, `GET /consents/{id}` and `POST /consents/{id}/revoke`;
  * the entity names from `GET /providers`. It is read here and not through `@modules/bank`, because the bank index already imports this module, and the import would go both ways.
* **`application/revocation.ts`**, the points where other modules plug in later without changing M4:
  * `installIdentityCheck`: M1 or M2 install the biometric or password check; until then the confirmation dialog alone protects the revocation;
  * `onConsentRevoked`: M5 deletes the link's bank token when the vault exists. A failing listener never undoes the revocation;
  * `revokeConsent(id)`, for M6's "Eliminar cuenta".
* **`application/useConsents.ts`:**
  * `useConsents`, `useConsent` and `useEntityNames`;
  * `useRevokeConsent`, which shows the new status in the list and the detail at once;
  * a person's consents leave the cache when no screen shows them, as M1 does with the profile.
* **`testing/fakeConsentsApi.ts`:** a fake of the port for the module's tests.
* **Tests:** domain, adapter, revocation and hooks, about 30 new.

## Result

* Tests: `make lint` and `make test` pass on the whole stack.
* Pull request: not opened yet.

## Decisions and problems

* **Daniel could not be asked,** so nothing was built in M1 or M2. Their part is a port they fill later in one line.
* **A test failed on some runs,** and the cause was real: a read that started before the revocation could land after it and show "Activo" again. The hook now cancels those reads first. The failure came from the third branch's run, so the fix is a separate commit on this branch.

## Next step

`feature/consents-list-screen`: the Consentimientos list.
