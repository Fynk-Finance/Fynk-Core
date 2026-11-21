---
date: 2026-10-28
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: feature/bank-providers-selector
tool: Claude Code
pr: none
status: done
---

# Providers list and entity selector of Conectar banco (M5)

## Instruction

After opening the M4 step 3 pull requests (#120, #121), the developer asked to keep going with the workflow. Key sentence: "Continue to push and open PRs and then let's keep going with the workflow." The next piece was the first host of the consent cards on M5's Conectar banco, as planned in the handoff. It is split into two branches stacked on #121; this is the first.

## What was done

* **`apps/mobile/src/modules/bank/`:**
  * `domain/provider.ts`: the `BankProvider` type, and `selectedProvider`, which gives the chosen entity or the first one;
  * `adapters/providersApi.ts`: `GET /providers`;
  * `application/useProviders.ts` (React Query), exported from `index.ts` as `useProviders()`;
  * `ui/EntitySelector.tsx`, from `ConectarBanco.html`:
    * "Banco o billetera digital", with the chosen entity, its kind ("Banco", "Billetera digital") and the "Simulado" badge;
    * a list to choose another entity.
* **Tests:** 12, covering:
  * the selection rule;
  * the adapter's mapping and errors;
  * the selector: shown entity, "Simulado" only on simulated entities, opening, choosing, closing, and both themes.

## Result

* Tests: `make lint` and `make test` pass on the whole stack.
* Pull request: not opened yet.
* Not checked on a phone.

## Decisions and problems

* **The open list is new.** The design exports the selector closed only, so the open list reuses the field's rows and colors: needs design review.
* **The tile shows the kind's icon** (bank or wallet) instead of the design's initials, because "Banco Demo" and "Billetera Demo" would both be "BD". Needs design review; real logos can come with `logoKey`.

## Next step

`feature/connect-bank-screen`: the Conectar banco screen with M4's consent part, stacked on this branch.
