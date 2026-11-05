// POST /recommendations with the shared API client.
import { api, unwrap } from '@shared/api';
import type { AggregateSnapshot } from '@shared/domain';

import type { RecommendationsApiPort } from '../../application/ports';

/** The contract has no nulls: an opportunity without a category omits the field. */
export function toRequestSnapshot(snapshot: AggregateSnapshot) {
  return {
    ...snapshot,
    opportunities: snapshot.opportunities.map(({ categoryId, ...o }) =>
      categoryId === null ? o : { ...o, categoryId },
    ),
  };
}

export function createRecommendationsApi(): RecommendationsApiPort {
  return {
    async create(snapshot, factKeys) {
      return unwrap(
        api.POST('/recommendations', {
          body: { snapshot: toRequestSnapshot(snapshot), factKeys },
        }),
      );
    },
  };
}
