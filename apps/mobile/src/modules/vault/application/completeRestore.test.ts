// The shared steps after the DEK is known: order, the mark and the undo on failure.
import { createCompleteRestore } from './completeRestore';

const DEK = Uint8Array.from({ length: 32 }, (_, i) => i + 9);

function setup(options: { openError?: Error; restoreError?: Error } = {}) {
  const calls: string[] = [];
  const step = (name: string, error?: Error) =>
    jest.fn(async () => {
      calls.push(name);
      if (error) throw error;
    });
  const deps = {
    dekStore: { write: step('write'), remove: step('remove') },
    vault: { wipe: step('wipe'), open: step('open', options.openError), close: step('close') },
    restoreState: {
      mark: step('mark'),
      clear: step('clear'),
      isPending: jest.fn(async () => false),
    },
    restoreAll: step('restoreAll', options.restoreError),
  };
  return { run: createCompleteRestore(deps), calls, deps };
}

describe('completeRestore', () => {
  it('wipes, writes copy A, opens, marks, downloads and clears the mark', async () => {
    const t = setup();
    expect(await t.run(DEK)).toBe('restored');
    expect(t.calls).toEqual(['wipe', 'write', 'open', 'mark', 'restoreAll', 'clear']);
    expect(t.deps.dekStore.write).toHaveBeenCalledWith(DEK);
  });

  it('leaves the vault open with the mark when the download is cut', async () => {
    const t = setup({ restoreError: new Error('offline') });
    expect(await t.run(DEK)).toBe('partial');
    expect(t.calls).toEqual(['wipe', 'write', 'open', 'mark', 'restoreAll']);
  });

  it('closes the vault and removes the key when it cannot open', async () => {
    const t = setup({ openError: new Error('corrupt') });
    expect(await t.run(DEK)).toBe('failed');
    expect(t.calls).toEqual(['wipe', 'write', 'open', 'close', 'remove']);
  });
});
