import {
  buildConsentRequest,
  canGoToPortal,
  consentErrorKind,
  purposeAndTerm,
  scopesOf,
  termLabel,
  type ConsentProvider,
  type ConsentText,
} from './consent';

const text: ConsentText = {
  version: '2026-10-v1',
  bodyMd: '# Autorización para compartir tus datos con Fynk',
  sha256: '9f2c4e0b7a1d3c5e8f6a2b4d6e8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f',
  publishedAt: '2026-10-27T00:00:00Z',
  purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
  termDays: 365,
};

const bancoDemo: ConsentProvider = {
  id: 'banco-demo',
  displayName: 'Banco Demo',
  supportedScopes: ['balances', 'transactions', 'account_details'],
};

describe('scopesOf', () => {
  it('keeps the design order whatever order the provider sends', () => {
    expect(scopesOf({ supportedScopes: ['account_details', 'balances', 'transactions'] })).toEqual([
      'balances',
      'transactions',
      'account_details',
    ]);
  });

  it('drops unknown and repeated scopes, so no open or general consent is asked', () => {
    expect(scopesOf({ supportedScopes: ['payments', 'balances', 'balances'] })).toEqual([
      'balances',
    ]);
  });

  it('returns nothing for a provider that shares nothing Fynk knows', () => {
    expect(scopesOf({ supportedScopes: [] })).toEqual([]);
  });
});

describe('termLabel', () => {
  it.each([
    [365, '12 meses'],
    [730, '24 meses'],
    [30, '1 mes'],
    [90, '3 meses'],
    [45, '45 días'],
    [1, '1 día'],
  ])('%i days is "%s"', (days, label) => {
    expect(termLabel(days)).toBe(label);
  });
});

describe('purposeAndTerm (HU-006: alcance y duración)', () => {
  it('writes the purpose and the term of the published text in plain words', () => {
    expect(purposeAndTerm(text)).toBe(
      'Finalidad: mostrarte tus finanzas y recomendaciones dentro de Fynk. Vigencia: 12 meses.',
    );
  });

  it('follows the API when the purpose or the term change', () => {
    expect(purposeAndTerm({ purpose: 'Analizar tus gastos', termDays: 90 })).toBe(
      'Finalidad: analizar tus gastos. Vigencia: 3 meses.',
    );
  });
});

describe('buildConsentRequest (HU-006: registrar explícitamente)', () => {
  it('sends exactly the scopes, purpose, term and text that were shown, with the evidence', () => {
    expect(buildConsentRequest({ provider: bancoDemo, text, appVersion: '0.1.0' })).toEqual({
      provider: 'banco-demo',
      scopes: ['balances', 'transactions', 'account_details'],
      purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
      termDays: 365,
      textVersion: '2026-10-v1',
      textSha256: text.sha256,
      appVersion: '0.1.0',
      locale: 'es-CO',
    });
  });

  it('asks only for what the provider shares', () => {
    const wallet = { ...bancoDemo, id: 'billetera-demo', supportedScopes: ['balances'] };
    expect(buildConsentRequest({ provider: wallet, text, appVersion: '0.1.0' }).scopes).toEqual([
      'balances',
    ]);
  });
});

describe('canGoToPortal', () => {
  const ready = { accepted: true, text, provider: bancoDemo, submitting: false };

  it('is enabled once the box is checked', () => {
    expect(canGoToPortal(ready)).toBe(true);
  });

  it('is disabled while the box is unchecked', () => {
    expect(canGoToPortal({ ...ready, accepted: false })).toBe(false);
  });

  it('is disabled without a text, a provider or a scope to share', () => {
    expect(canGoToPortal({ ...ready, text: undefined })).toBe(false);
    expect(canGoToPortal({ ...ready, provider: undefined })).toBe(false);
    expect(canGoToPortal({ ...ready, provider: { ...bancoDemo, supportedScopes: [] } })).toBe(
      false,
    );
  });

  it('is disabled while the consent is being recorded', () => {
    expect(canGoToPortal({ ...ready, submitting: true })).toBe(false);
  });
});

describe('consentErrorKind', () => {
  it.each([
    ['unknown_text_version', 'text_changed'],
    ['text_mismatch', 'text_changed'],
    ['purpose_mismatch', 'text_changed'],
    ['term_mismatch', 'text_changed'],
    ['device_required', 'device'],
    ['unsupported_provider', 'provider'],
    ['invalid_scopes', 'provider'],
    ['network_error', 'network'],
    ['idempotency_conflict', 'unknown'],
    [undefined, 'unknown'],
  ] as const)('%s is %s', (code, kind) => {
    expect(consentErrorKind(code)).toBe(kind);
  });
});
