# ADR 0008: Simulated bank accounts created at sign up (demo only)

* Status: accepted, for the demo only
* Date: 2026-11-06
* Owner: M16b Simulated banks (Daniel Palacios / `@Komi-yes`), reviewed by every module owner
* Jira: SCRUM-73 (HU-056), SCRUM-74 (HU-057), SCRUM-75 (HU-058)

## Context

The jury demo needs each person to see their own accounts in the onboarding Cuentas step. Today every simulator customer gets the same balances, so every user looks the same. Architecture rule 8 and the HU-047 criterion say the simulator creates accounts when the person gives a consent, never at the Fynk sign up. With that rule the Cuentas step would show nothing before the first link.

## Decision

The team decided on 6 Nov 2026 that every new Fynk user gets random accounts in four fictional entities: Banco Demo, Billetera Demo, Banco Digital Demo and Cooperativa Demo. The accounts are created at the first part of the Fynk sign up, when the first device is registered.

* **Provisioning call.** The Fynk backend calls a demo-only simulator endpoint, `POST /demo/v1/customers`.
  * The body has only the Keycloak `sub`, which is opaque. No email, name or cédula is sent.
  * The call uses mTLS and a client_credentials token (`private_key_jwt`, scope `demo:provision`).
* **Login and consent do not change.** The person still logs in to the bank ("Ingresar con Fynk", through Keycloak brokering) and accepts one consent per entity.
* **No entity list in Fynk.** Fynk does not store which entities a user has. It asks the simulator each time.
* **Random but safe data.** Balances are random and deterministic per user. They are never negative. Credit cards carry a random debt below their limit.
* **The seeded demo user is unchanged.** `fixtures/demo-user.json` stays as it is.

## Why this is an exception to rule 8

This is for the demo only. A real bank would never open accounts because a third party asked. In production Fynk could not do this. Real banks are only read through the person's consent, and Bancolombia works that way. The simulator allows it because it is our own fake bank and we need every juror to see different data.

## Consequences

* The simulator stores the Fynk `sub` as its customer id. It is never the email, name or cédula.
* The HU-047 criterion "accounts are created at consent, never at the Fynk sign up" is replaced by HU-056.
* Bancolombia is not affected. It keeps the consent-only flow.
* Nothing new in M0 config. The simulator settings that M5 already uses are enough.
* If the simulator is down at sign up, the registration still works. The creation is tried again when the app asks for the list of entities.
* The provisioning endpoint exists only where the simulator is configured (local and staging). It must not be exposed in any real deployment.

## Alternatives considered

* **Accounts at the first consent.** Rejected. The Cuentas step would show nothing before the first link.
* **One Banco Demo with fixed data.** Rejected. Every user would look the same.
