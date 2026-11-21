# Retry the AI after 5 minutes when the server fell back

* Who: Julián Castiblanco (`@JulCR34l`)
* Module: M11 AI recommendations
* Jira: SCRUM-38 (HU-024)
* Branch: `fix/recommendations-retry-after-fallback`

## Instruction

Daniel asked to see the AI recommendation in the app, not only in the backend tests: "toca que en la aplicación se vea la recomendación". Julián ran the app on the Android emulator against the local stack with Gemini.

## What was found

* The app reached the backend (`POST /v1/recommendations`) and the backend called Gemini, but Gemini failed (free tier quota, then 12 s timeouts), so the server answered `fallback: true`.
* The phone cached that fallback as if it were a text for those numbers. With the same numbers it never asked again, not even after the hour. In the demo, one failed call would hide the AI for the whole session.
* The "Recomendaciones con IA" switch in Privacidad y datos (M13) keeps its value only while the screen is open and does not call `useAiRecommendationsSetting()`. Reported to M13; not changed here.

## What was done

* A fallback answer no longer counts as the text of a snapshot, and the phone asks again 5 minutes after a fallback (`RETRY_AFTER_FALLBACK_MS`) instead of an hour. A real text keeps the hourly rule.
* Test: `asks again after 5 minutes, not an hour, when the model failed and the server fell back`.

## Result

* Jest for `src/modules/recommendations` (26 tests), ESLint, Prettier and `tsc` pass.

## Next step

Julián tests it in the emulator once Gemini has quota, and asks M13 to wire the switch.
