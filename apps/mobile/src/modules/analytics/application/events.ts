// Keeps caps and cached numbers fresh: on every sync, change of movements and vault unlock, the
// caps are evaluated (alerts) and the cached queries of the module are invalidated.
import type { AppEvents } from '@shared/events/appEvents';

import type { AnalyticsService } from './analyticsService';

export const ANALYTICS_REFRESH_EVENTS = [
  'sync.completed',
  'transactions.changed',
  'vault.unlocked',
] as const;

export function subscribeAnalyticsEvents(
  events: AppEvents,
  service: Pick<AnalyticsService, 'evaluateCaps'>,
  onDataChanged: () => void,
  onError: (error: unknown) => void = () => undefined,
): () => void {
  const handle = () => {
    onDataChanged();
    service.evaluateCaps().catch(onError);
  };
  const unsubscribers = ANALYTICS_REFRESH_EVENTS.map((type) => events.on(type, handle));
  return () => unsubscribers.forEach((off) => off());
}
