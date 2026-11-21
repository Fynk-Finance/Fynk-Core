---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-44]
branch: feature/bancolombia-adapter-tokens
tool: Claude Code
pr: none
status: done
---

# Bancolombia adapter: token calls

## Instruction

Juan Carlos asked to finish M4 and M5 and to build the Bancolombia part with the API Market access he got: "the idea es to use the sandbox"; "create that part and tell what to do so that we can link that." For the customer document that Bancolombia's consent API requires, he chose to send only the sandbox's fictional customer from the settings.

## What was done

* Read Bancolombia's API Market sandbox in the built-in browser (Open Banking Authorization and Account Information specs) and its live discovery document.
* New `bank/adapters/bancolombia`: settings, the token endpoint (client credentials, authorization code with PKCE, refresh) with `private_key_jwt` and the API Market's `Client-Id`/`Client-Secret` headers, and error mapping without the bank's text. `RevokeConsent` answers `revocation_not_supported`; no CDT catalog.
* The adapter refuses to start outside the sandbox or without the sandbox customer (rule 10).
* Tests on a fake Bancolombia that answers the documented examples.

## Result

* Tests pass; golangci-lint 0 issues. Pull request: not opened yet.

## Decisions and problems

* The token API lists the scope `account`, while the PAR and resource docs say `accounts`. The adapter uses `account`; the sandbox test settles it (ADR 0003).
* The layer was split from the PAR layer to keep each pull request near 400 lines.

## Next step

The consent and the PAR.
