// Ports of the recommendations module.
import type { AggregateSnapshot, IsoDateTime } from '@shared/domain';
import type { Opportunity } from '@modules/analytics';

import type { ModelTexts } from '../domain/steps';

/** M10: the snapshot and the opportunities, computed from the same inputs. */
export interface AnalyticsReportPort {
  getReport(): Promise<{ snapshot: AggregateSnapshot; opportunities: Opportunity[] }>;
}

/** POST /recommendations. */
export interface RecommendationsApiPort {
  create(snapshot: AggregateSnapshot, factKeys: string[]): Promise<ModelTexts>;
}

export interface CachedTexts {
  snapshotKey: string;
  texts: ModelTexts;
  createdAt: IsoDateTime;
}

/** The last answer, kept in the vault so it shows at once and offline. */
export interface RecommendationsStore {
  getCached(): Promise<CachedTexts | null>;
  putCached(entry: CachedTexts): Promise<void>;
  clearCached(): Promise<void>;
  /** "Recomendaciones con IA" switch of Privacidad y datos. On by default. */
  isAiEnabled(): Promise<boolean>;
  setAiEnabled(enabled: boolean): Promise<void>;
}
