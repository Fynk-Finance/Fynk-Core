---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M5
jira: [SCRUM-75]
branch: feature/simulated-banks-mobile-entities
tool: Claude Code
pr: none
status: done
---

# M5 mobile: list the simulated entities of the person

## Instruction

Daniel said "continue with the rest of the steps": step 6b, the app shows the simulated entities where the person has accounts, plus the real providers.

## What was done

* `adapters/providersApi.ts` and `application/ports.ts`: `ProvidersPort.simulatedEntities()` calls `GET /bank/simulated-entities` (types come from the generated `schema.gen.ts`).
* `domain/provider.ts`: `visibleProviders(all, mine)` keeps every real provider and only the simulated entities in `mine`; with `mine` equal to `null` it keeps everything. `SIMULATOR_ENTITY_IDS` lists the four simulator ids, because `GET /providers` also flags Bancolombia's sandbox as simulated.
* `application/useProviders.ts`: loads the catalog and the person's entities together; a failed second call becomes `null`, so every entity is shown and the step never blocks.
* Tests: `visibleProviders` cases, the adapter (200 and 503), `useProviders.test.tsx` (filtered list, and the fallback), `index.test.ts` mock extended, and a sync engine case with three simulated links: all sync, the 60 s minimum applies to each, and a revoked consent ends only its own link.
* Unchanged: `BankLinkList`, `ConnectBankButton` and `ConnectBankScreen` exports and props, the strings, and every screen. The selector already shows the "Simulado" badge from `isSimulated`.

## Result

* `pnpm --filter @fynk/mobile test -- modules/bank` passes (21 suites, 140 tests), `eslint --max-warnings 0` and `tsc --noEmit` pass, Prettier check passes on `modules/bank`.
* Pull request: not opened yet. It stacks on `feature/simulated-banks-entities-endpoint`.

## Decisions and problems

* The module's `ConnectBankScreen` tests use the real adapter with a fake fetch that does not know the new path, so they now run through the fallback (every entity), which still matches what they expected.
* The design has one selector row for every provider, so the two new entities need no new screen; their logos are not drawn by the selector today, so there is nothing to review in the design.

## Next step

Call the demo provisioner when the first device registers (M1).
