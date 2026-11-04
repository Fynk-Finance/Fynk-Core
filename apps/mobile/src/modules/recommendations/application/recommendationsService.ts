// Use cases of Recomendaciones. Numbers and order come from M10; the model only writes text.
// The model's text is shown only next to the snapshot it was written from, so a text can never
// contradict the numbers on screen. A new text is asked for at most once per hour.
import { isApiError } from '@shared/api';
import type { AggregateSnapshot, Clock, IsoDate } from '@shared/domain';
import type { Opportunity } from '@modules/analytics';

import { canRegenerate, snapshotKey, type ModelTexts } from '../domain/steps';
import type { AnalyticsReportPort, RecommendationsApiPort, RecommendationsStore } from './ports';

export type Notice = 'none' | 'ai_off' | 'offline' | 'rate_limited';

export interface RecommendationsView {
  opportunities: Opportunity[];
  /** Model texts for exactly these numbers, or null (templates). */
  texts: ModelTexts | null;
  /** Range of the movements the numbers come from (traceability, HU-024). */
  dataRange: { from: IsoDate; to: IsoDate };
  notice: Notice;
  aiEnabled: boolean;
}

export interface RecommendationsDeps {
  analytics: AnalyticsReportPort;
  api: RecommendationsApiPort;
  store: RecommendationsStore;
  clock: Clock;
  dataRange: (snapshot: AggregateSnapshot) => { from: IsoDate; to: IsoDate };
}

export type RecommendationsService = ReturnType<typeof createRecommendationsService>;

export function createRecommendationsService(deps: RecommendationsDeps) {
  const read = async () => {
    const [{ snapshot, opportunities }, cached, aiEnabled] = await Promise.all([
      deps.analytics.getReport(),
      deps.store.getCached(),
      deps.store.isAiEnabled(),
    ]);
    const key = snapshotKey(JSON.stringify(snapshot));
    const matching = aiEnabled && cached && cached.snapshotKey === key ? cached.texts : null;
    return { snapshot, opportunities, cached, aiEnabled, key, matching };
  };

  const view = (
    r: Awaited<ReturnType<typeof read>>,
    texts: ModelTexts | null,
    notice: Notice,
  ): RecommendationsView => ({
    opportunities: r.opportunities,
    texts,
    dataRange: deps.dataRange(r.snapshot),
    notice: r.aiEnabled ? notice : 'ai_off',
    aiEnabled: r.aiEnabled,
  });

  return {
    /** What to show right away: the cached text when it matches today's numbers. No network. */
    async load(): Promise<RecommendationsView> {
      const r = await read();
      return view(r, r.matching, 'none');
    },

    /**
     * Asks the model for new text when the numbers changed and the last call is at least an hour
     * old (on open and on pull to refresh). One call, one snapshot. Never throws for network
     * problems: the screen keeps its numbers and templates.
     */
    async refresh(): Promise<RecommendationsView> {
      const r = await read();
      if (!r.aiEnabled) return view(r, null, 'ai_off');
      if (r.matching) return view(r, r.matching, 'none');
      if (r.cached && !canRegenerate(r.cached.createdAt, deps.clock.now())) {
        return view(r, null, 'none');
      }
      try {
        const texts = await deps.api.create(
          r.snapshot,
          r.opportunities.map((o) => o.factKey),
        );
        await deps.store.putCached({
          snapshotKey: r.key,
          texts,
          createdAt: deps.clock.now().toISOString(),
        });
        return view(r, texts, 'none');
      } catch (error) {
        if (isApiError(error) && error.code === 'rate_limited')
          return view(r, null, 'rate_limited');
        return view(r, null, 'offline');
      }
    },

    async isAiEnabled(): Promise<boolean> {
      return deps.store.isAiEnabled();
    },

    /** Turning the AI off stops sending the snapshot and drops the cached model text. */
    async setAiEnabled(enabled: boolean): Promise<void> {
      await deps.store.setAiEnabled(enabled);
      if (!enabled) await deps.store.clearCached();
    },
  };
}
