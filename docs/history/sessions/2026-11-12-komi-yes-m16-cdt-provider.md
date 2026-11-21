---
date: 2026-11-12
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-65]
branch: fix/banco-demo-cdt-provider
tool: Claude Code
pr: "#380"
status: done
---

# A CDT opened in the Banco Demo portal reaches Fynk

## Instruction

Same session as `2026-11-12-komi-yes-m16-portal-login.md`. After the portal login fix, the developer asked: "check why when for example generating a CDT with my account is not appering in the app check if the error is also happening with the other 3 options".

## What was done

* Cause: `OpenCDT` in `services/bank-simulator/internal/store/store.go` created the CDT account with no `ProviderID`. `GET /accounts` returns only the accounts of the consent's entity, so the new CDT was filtered out for every link. The CDT now gets the provider of the account that paid for it.
* The other three actions of the portal (Registrar un pago, Transferir, Pagar tarjeta) did reach `GET /transactions`. Their movements only had an empty `providerId`, which the Fynk backend does not read. Every movement the portal books now carries its account's provider id, like the generated ones.
* Tests: `internal/store/portal_actions_test.go` runs the four actions through `GetAccounts` and `GetTransactions` of a consent, including a transfer between Banco Demo and Cooperativa Demo and a CDT paid from Cooperativa Demo. They failed before the fix.

## Result

* Tests: the new tests and the other packages of the simulator pass. The `internal/oauth` test binary was blocked by Windows App Control on this machine; it is not changed here and CI runs it.
* Pull request: #380.
* Works with the portal login fix (`fix/banco-demo-portal-login`): without it, portal actions run on the demo customer and never reach the person's app.

## Decisions and problems

* A CDT belongs to the entity of the account that paid for it, so it shows in that entity's link even when it is not Banco Demo.
* Found and not fixed (other modules, frozen contract): the app accepts only `banco-demo`, `billetera-demo` and `bancolombia` as providers (`ProviderId` in `apps/mobile/src/shared/domain/types.ts` and `00-shared-contracts.md`, `PROVIDERS` in `modules/bank/domain/syncMapping.ts`, the `CHECK` on `provider` in `modules/accounts/adapters/vault/migrations.ts`). A link to Banco Digital Demo or Cooperativa Demo can be made, but every sync of it fails with `Unknown provider`, so nothing from those two entities shows. This needs a shared contract change reviewed by M0, M5 and M6.
* `services/bank-simulator/` is owned by `@juancontrerasp`, so the pull request needs that approval.

## Next step

Take the shared contract change for the two missing provider ids to the team.
