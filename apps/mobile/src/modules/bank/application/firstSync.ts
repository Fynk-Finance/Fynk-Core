// The first sync of a new link (M5 prompt, Link flow step 5: "run first sync (12 months)").
// Conectar banco starts it as soon as the bank returns the tokens, so the movements are there
// when the person reaches the Dashboard. A sync that was already running (the app had just
// opened) read the links before this one existed, so in that case it asks once more.
import type { Id } from '@shared/domain/types';

import type { SyncReport } from './syncEngine';

export async function syncNewLink(syncNow: () => Promise<SyncReport>, linkId: Id): Promise<void> {
  const report = await syncNow();
  if (report.status !== 'done') return;
  if (report.links.some((l) => l.linkId === linkId)) return;
  await syncNow();
}
