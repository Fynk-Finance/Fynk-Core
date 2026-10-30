// The new phone's side of an approval, as screen state: ask, then look every 5 seconds while the
// waiting view is in front. It stops on cancel, on any final answer, at the request's expiry and
// on unmount. The id, the code and the answers live only in this state.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApprovalCheck, ApprovalStart } from '../application/restoreWithApproval';
import { POLL_INTERVAL_MS } from './ApproveDeviceScreen';
import type { vaultStrings } from './strings.es-CO';

export type ApprovalMessage = keyof typeof vaultStrings.restore.approval.messages;

export interface ApprovalRequestView {
  id: string;
  code: string;
  expiresAt: string;
}

export interface UseApprovalRestoreArgs {
  /** True while the restore runs: the poll rests, the screen shows its spinner. */
  restoring: boolean;
  onStart: () => Promise<ApprovalStart>;
  onCheck: (id: string) => Promise<ApprovalCheck>;
}

export function useApprovalRestore({ restoring, onStart, onCheck }: UseApprovalRestoreArgs) {
  const [starting, setStarting] = useState(false);
  const [request, setRequest] = useState<ApprovalRequestView | null>(null);
  const [message, setMessage] = useState<ApprovalMessage | null>(null);
  // A poll answered "offline": the view says so and keeps trying.
  const [offline, setOffline] = useState(false);
  // The request the person is waiting for. Cleared by cancel, so a late answer is ignored.
  const active = useRef<string | null>(null);
  const checking = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    active.current = null;
    setRequest(null);
    setOffline(false);
  }, []);

  const poll = useCallback(
    async (current: ApprovalRequestView) => {
      if (checking.current) return;
      checking.current = true;
      let result: ApprovalCheck;
      try {
        result = await onCheck(current.id);
      } catch {
        result = 'failed';
      } finally {
        checking.current = false;
      }
      if (!mounted.current || active.current !== current.id) return;
      // The server decides expiry; this only stops the poll if its answer is late.
      if (result === 'waiting' && Date.now() >= Date.parse(current.expiresAt)) result = 'expired';
      if (result === 'waiting' || result === 'offline') {
        setOffline(result === 'offline');
      } else if (result !== 'restored' && result !== 'partial') {
        stop();
        setMessage(result);
      }
    },
    [onCheck, stop],
  );

  useEffect(() => {
    if (!request || restoring) return;
    const timer = setInterval(() => void poll(request), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [request, restoring, poll]);

  const begin = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setMessage(null);
    let result: ApprovalStart;
    try {
      result = await onStart();
    } catch {
      result = { status: 'failed' };
    }
    if (!mounted.current) return;
    setStarting(false);
    if (result.status === 'started') {
      active.current = result.id;
      setRequest({ id: result.id, code: result.code, expiresAt: result.expiresAt });
    } else {
      setMessage(result.status === 'failed' ? 'startFailed' : result.status);
    }
  }, [onStart, starting]);

  const cancel = useCallback(() => {
    stop();
    setMessage(null);
  }, [stop]);

  return { starting, request, message, offline, begin, cancel };
}
