---
date: 2026-11-12
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: docs/bancolombia-support-status
tool: Claude Code
pr: none
status: done
---

# Check Bancolombia's portal and record how to present the connection

## Instruction

Bancolombia's support had not answered and time is short. Juan Carlos asked to try every approach before telling the team: "check wether the petition was accpeted of we can use any of the other services in order to fulfill the requierments", then approved recording the result in ADR 0003: "Yes, update ADR".

## What was done

* Rechecked the sandbox live: discovery answers; account calls still answer `401 invalid_client` without a certificate from the Ozone test CA.
* Browsed the API Market signed in as Juan Carlos, in his own Chrome (the portal's Microsoft sign-in is a popup the built-in browser blocks). Only read; nothing was subscribed, reset or deleted. The portal moved to `api-portal-external.apps.bancolombia.com`; the application "Fynk" has 0 products; none of the 93 subscribable products is Open Finance; the four Open Finance products exist only as documentation.
* Tried to follow the support request: the ticket site rejects the university account (`AADSTS50105`), so answers come only by email.
* Read the help center on certificates, `private_key_jwt` and JWKS.
* `docs/adr/0003-bancolombia-sandbox.md`: status and date, the request date corrected to 6 Nov, findings 10 to 12, steps 4 and 5 of section 5 marked done (#326, `a5bd451`), a new section 6 "How to present it to the jury", and the new sources.

## Result

* No code changed. Prettier passes on the ADR.
* Pull request: not opened yet.

## Decisions and problems

* Recommended to Juan Carlos, who agreed to record it: the jury demo uses the simulated banks; Bancolombia is shown as an adapter that reaches the bank (tests from its documentation and a live call that stops at the missing certificate) with the findings; no mock with Bancolombia's name in the app.
* Still to try on Bancolombia's side: reply to the ticket email, the API Market chat, and a contact through the university.

## Next step

If Bancolombia answers, put the certificate in `certs/` and run the sandbox tests of ADR 0003, section 5, step 2.
