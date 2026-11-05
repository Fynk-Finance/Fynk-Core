// How many detected proposals wait for the person, for the Billetera banner. Read again every
// time the items reload, which happens after a sync and after each confirm or dismiss.
import { useEffect, useState } from 'react';

export function usePendingProposals(load: (() => Promise<number>) | undefined, version: unknown) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!load) return;
    let alive = true;
    load()
      .then((n) => {
        if (alive) setCount(n);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [load, version]);
  return count;
}
