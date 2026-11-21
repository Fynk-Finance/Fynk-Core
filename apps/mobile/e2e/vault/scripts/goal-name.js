/* global output -- provided by Maestro's runScript */
// A goal name that only this run knows, so the last assertion cannot pass on an old goal. It is
// short: the goal form accepts 40 characters.
output.goalName = 'Meta E2E ' + Date.now();
