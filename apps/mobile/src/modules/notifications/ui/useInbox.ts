// Inbox state for the screen and the bell. Reloads whenever the service reports a change.
// While the vault is locked the inbox reads as empty: the vault gate keeps the screens hidden
// then, and nothing can be unread before the vault opens.
import { useCallback, useEffect, useState } from 'react';

import { VaultLockedError } from '@shared/ports';

import type { InboxItem } from '../domain/inbox';
import type { NotificationService } from '../application/notificationService';

export type InboxState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: InboxItem[] };

const lockedAsEmpty =
  <T>(empty: T) =>
  (error: unknown) => {
    if (error instanceof VaultLockedError) return empty;
    throw error;
  };

export function useInbox(service: NotificationService) {
  const [state, setState] = useState<InboxState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const items = await service.list().catch(lockedAsEmpty<InboxItem[]>([]));
      setState({ status: 'ready', items });
    } catch {
      setState({ status: 'error' });
    }
  }, [service]);

  useEffect(() => {
    let active = true;
    const reload = () => {
      if (active) void load();
    };
    const unsubscribe = service.subscribe(reload);
    // Reminders whose time passed while the app was closed go into the inbox first.
    void service
      .deliverDue()
      .catch(() => 0)
      .finally(reload);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service, load]);

  return { state, reload: load };
}

/** Unread rows, for the bell of HeaderBlue (`hasUnread={useUnreadCount() > 0}`). */
export function useUnreadCount(service: NotificationService): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => {
      service
        .unreadCount()
        .catch(lockedAsEmpty(0))
        .then(
          (n) => {
            if (active) setCount(n);
          },
          () => undefined, // keep the last count; the screen shows the error
        );
    };
    const unsubscribe = service.subscribe(load);
    load();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);
  return count;
}
