// The first sync after linking (M5 prompt, Link flow step 5; HU-010 "Historial de los últimos
// 12 meses" starts here).
import { syncNewLink } from './firstSync';
import type { SyncReport } from './syncEngine';

const synced = (linkId: string): SyncReport => ({
  status: 'done',
  links: [{ linkId, provider: 'banco-demo', kind: 'synced' }],
});

it('syncs once when the run includes the new link', async () => {
  const syncNow = jest.fn(async () => synced('link-new'));
  await syncNewLink(syncNow, 'link-new');
  expect(syncNow).toHaveBeenCalledTimes(1);
});

it('asks again when a sync that started before the link did not include it', async () => {
  const syncNow = jest
    .fn<Promise<SyncReport>, []>()
    .mockResolvedValueOnce(synced('link-old'))
    .mockResolvedValueOnce(synced('link-new'));
  await syncNewLink(syncNow, 'link-new');
  expect(syncNow).toHaveBeenCalledTimes(2);
});

it('does not ask again when the vault is locked or the engine is not there', async () => {
  for (const status of ['locked', 'unavailable'] as const) {
    const syncNow = jest.fn(async (): Promise<SyncReport> => ({ status, links: [] }));
    await syncNewLink(syncNow, 'link-new');
    expect(syncNow).toHaveBeenCalledTimes(1);
  }
});
