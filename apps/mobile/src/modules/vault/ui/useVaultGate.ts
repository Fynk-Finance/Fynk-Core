// The vault gate: open while there is a session and the vault is not unlocked.
import { useEffect, useSyncExternalStore } from 'react';

import type { LockController } from '../application/lockController';

export interface VaultGateDeps {
  controller: LockController;
  /** Identity's useSession, passed in so this file never calls identity while it loads. */
  useSession: () => { status: string };
  /** Feeds foreground and background changes to the controller. Returns the unsubscribe. */
  watchAppState: (controller: LockController) => () => void;
}

export function createUseVaultGate({ controller, useSession, watchAppState }: VaultGateDeps) {
  // Same hooks in the same order on every render: RootNavigator calls every gate every time.
  return function useVaultGate(): boolean {
    const session = useSession();
    const lock = useSyncExternalStore(controller.subscribe, controller.getState);

    useEffect(() => {
      const stopSession = controller.start();
      const stopAppState = watchAppState(controller);
      return () => {
        stopSession();
        stopAppState();
      };
    }, []);

    const signedIn = session.status === 'signedIn';
    useEffect(() => {
      if (signedIn) void controller.unlock();
    }, [signedIn]);

    return signedIn && lock.status !== 'unlocked';
  };
}
