// The signed in account's vault slot, read on every call. identity/index.ts imports the vault, so
// identity is only called inside these functions, never while this file loads.
import { userId } from '@modules/identity';

import { vaultSlot } from '../domain/vaultSlot';

// The last slot this process saw. Only removals may use it (see removalSlot).
let last: string | null = null;

/** The signed in account's slot, or null when nobody is. Reads and writes use only this. */
export function currentSlot(): string | null {
  const id = userId();
  if (id === null) return null;
  last = vaultSlot(id);
  return last;
}

/**
 * The slot a removal targets: the current one, else the last one known to this process, so a
 * wipe after sign out (device removed) still erases the account's vault. Removing never leaks data.
 */
export function removalSlot(): string | null {
  return currentSlot() ?? last;
}

/** Tells the removal slot which account is about to be wiped, e.g. just before it signs out. */
export function rememberAccount(id: string): void {
  last = vaultSlot(id);
}
