/* global output -- provided by Maestro's runScript */
// A new throwaway address for each run, so the local realm never sees a duplicate email.
// Mailpit takes the mail of any domain; fynk.test is reserved and never delivered anywhere.
output.email = 'e2e-' + Date.now() + '@fynk.test';
