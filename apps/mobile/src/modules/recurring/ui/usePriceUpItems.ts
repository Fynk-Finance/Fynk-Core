// Subscriptions with an open price alert, for the red "Subió" chip in Billetera. Read again
// every time the items reload (after a sync and after the person dismisses an alert).
import { useEffect, useState } from 'react';

const NONE: ReadonlySet<string> = new Set();

export function usePriceUpItems(
  load: (() => Promise<Set<string>>) | undefined,
  version: unknown,
): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(NONE);
  useEffect(() => {
    if (!load) return;
    let alive = true;
    load()
      .then((set) => {
        if (alive) setIds(set);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [load, version]);
  return ids;
}
