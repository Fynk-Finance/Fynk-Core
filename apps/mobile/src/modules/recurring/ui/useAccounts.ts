// The accounts and cards of M6, to show which one each subscription is charged to. Empty while
// they load, when M6 is not wired (tests) or when the vault is locked.
import { useEffect, useState } from 'react';

import type { Account } from '@shared/domain/types';

export function useAccounts(load?: () => Promise<Account[]>): Account[] {
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    if (!load) return;
    let alive = true;
    load()
      .then((list) => {
        if (alive) setAccounts(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [load]);
  return accounts;
}
