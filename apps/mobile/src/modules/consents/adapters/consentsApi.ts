import { api, unwrap, type ApiClient, type components } from '@shared/api';

import type { Consent, ConsentText } from '../domain/consent';
import type { ConsentsApiPort } from '../application/ports';

type ApiConsent = components['schemas']['ConsentsConsent'];

const toConsent = (c: ApiConsent): Consent => ({
  id: c.id,
  provider: c.provider,
  scopes: c.scopes,
  purpose: c.purpose,
  termDays: c.termDays,
  status: c.status,
  textVersion: c.textVersion,
  createdAt: c.createdAt,
  acceptedAt: c.acceptedAt,
  ...(c.grantedAt !== undefined && { grantedAt: c.grantedAt }),
  ...(c.expiresAt !== undefined && { expiresAt: c.expiresAt }),
  ...(c.revokedAt !== undefined && { revokedAt: c.revokedAt }),
  ...(c.providerNotifiedAt !== undefined && { providerNotifiedAt: c.providerNotifiedAt }),
});

/** The consents endpoints through the shared client, which adds the token and X-Device-Id. */
export function createConsentsApi(client: ApiClient = api): ConsentsApiPort {
  return {
    async currentText(): Promise<ConsentText> {
      const t = await unwrap(client.GET('/consent-texts/current'));
      return {
        version: t.version,
        bodyMd: t.bodyMd,
        sha256: t.sha256,
        publishedAt: t.publishedAt,
        purpose: t.purpose,
        termDays: t.termDays,
      };
    },
    async create(request, idempotencyKey) {
      const consent = await unwrap(
        client.POST('/consents', {
          body: request,
          params: { header: { 'Idempotency-Key': idempotencyKey } },
        }),
      );
      return toConsent(consent);
    },
    async list() {
      const { items } = await unwrap(client.GET('/consents'));
      return items.map(toConsent);
    },
    async get(id) {
      return toConsent(await unwrap(client.GET('/consents/{id}', { params: { path: { id } } })));
    },
    async revoke(id) {
      return toConsent(
        await unwrap(client.POST('/consents/{id}/revoke', { params: { path: { id } } })),
      );
    },
    // M5's provider list is read here instead of through @modules/bank, whose index already
    // imports this module (Conectar banco hosts the consent part).
    async entityNames() {
      const { items } = await unwrap(client.GET('/providers'));
      return Object.fromEntries(items.map((p) => [p.id, p.displayName]));
    },
  };
}
