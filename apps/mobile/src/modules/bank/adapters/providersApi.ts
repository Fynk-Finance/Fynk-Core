import { api, unwrap, type ApiClient } from '@shared/api';

import type { ProvidersPort } from '../application/ports';

export function createProvidersApi(client: ApiClient = api): ProvidersPort {
  return {
    async list() {
      const { items } = await unwrap(client.GET('/providers'));
      return items.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        kind: p.kind,
        isSimulated: p.isSimulated,
        supportedScopes: [...p.supportedScopes],
        logoKey: p.logoKey,
      }));
    },
  };
}
