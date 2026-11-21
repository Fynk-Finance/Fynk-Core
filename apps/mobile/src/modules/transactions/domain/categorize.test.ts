// Categorization table tests (HU-018 categorías predeterminadas): every merchant string of the
// demo fixture plus common Colombian merchants and bank descriptions.
import { normalizeMerchant } from '@shared/domain/normalizeMerchant';
import type { CategoryId, Transaction } from '@shared/domain/types';

import demoUser from '../../../../../../fixtures/demo-user.json';
import { categorize, ruleText, type CategorizeContext } from './categorize';

const ctx: CategorizeContext = {
  txOverrides: new Map(),
  merchantOverrides: new Map(),
  treatsThresholdMinor: 2_000_000,
};

const tx = (description: string, amountMinor: number, merchantRaw: string | null = null) => ({
  providerTxId: 'p-1',
  description,
  merchantRaw,
  merchantKey: merchantRaw ? normalizeMerchant(merchantRaw) : null,
  amountMinor,
});

// [description, amount in pesos, expected]
const COLOMBIA: [string, number, CategoryId][] = [
  ['ÉXITO CALLE 80 BOGOTÁ', -184_300, 'groceries'],
  ['COMPRA POS D1 SUBA', -45_000, 'groceries'],
  ['TIENDAS ARA KENNEDY', -38_200, 'groceries'],
  ['OLIMPICA SAO', -72_500, 'groceries'],
  ['CARULLA EXPRESS', -95_000, 'groceries'],
  ['Tienda de barrio', -20_100, 'groceries'],
  ['UBER *TRIP', -16_200, 'transport'],
  ['DIDI RIDES', -12_900, 'transport'],
  ['TRANSMILENIO RECARGA TULLAVE', -40_000, 'transport'],
  ['Taxi', -22_000, 'transport'],
  ['NETFLIX.COM', -38_900, 'subscriptions'],
  ['SPOTIFY P1F3', -16_900, 'subscriptions'],
  ['DISNEY PLUS', -32_900, 'subscriptions'],
  ['APPLE.COM/BILL ICLOUD', -3_900, 'subscriptions'],
  ['ARRIENDO APTO 301', -1_400_000, 'rent'],
  ['EPM SERVICIOS PUBLICOS', -186_000, 'utilities'],
  ['CODENSA ENEL FACTURA', -120_000, 'utilities'],
  ['VANTI GAS NATURAL', -45_000, 'utilities'],
  ['CLARO MOVIL', -65_000, 'telecom'],
  ['MOVISTAR HOGAR', -89_900, 'telecom'],
  ['TIGO RECARGA', -20_000, 'telecom'],
  ['NOMINA ACME SAS', 5_200_000, 'salary'],
  ['PAGO SALARIO OCTUBRE', 4_200_000, 'salary'],
  ['Transferencia a Nequi', -150_000, 'transfers'],
  ['TRANSFERENCIA RECIBIDA DAVIPLATA', 120_000, 'transfers'],
  ['CREPES & WAFFLES ANDINO', -72_000, 'restaurants'],
  ['JUAN VALDEZ CAFE', -9_800, 'treats'],
  ['RAPPI*RESTAURANTE', -18_000, 'treats'],
  ['CINE COLOMBIA TITAN', -34_000, 'cinema'],
  ['DROGUERIA LA REBAJA', -46_200, 'health'],
  ['FARMATODO', -23_000, 'health'],
  ['SMART FIT', -89_900, 'gym'],
  ['MERCADO LIBRE COLOMBIA', -159_900, 'shopping'],
  ['FALABELLA ANDINO', -210_000, 'shopping'],
  ['CUOTA DE MANEJO TARJETA', -28_000, 'fees'],
  ['GMF 4X1000', -1_200, 'fees'],
  ['MATRICULA UNIVERSIDAD', -3_500_000, 'education'],
  ['COMPRA POS 12345', -10_000, 'other'],
];

const fixture = demoUser as unknown as { transactions: Transaction[] };

// One case per distinct merchant string of the demo fixture, with the fixture's category.
const FIXTURE = [
  ...new Map(fixture.transactions.map((t) => [`${t.description}|${t.merchantRaw}`, t])).values(),
].map((t) => [t.description, t.amountMinor, t.merchantRaw, t.categoryId] as const);

describe('categorize: Colombian merchants', () => {
  it('covers at least 40 merchant strings in all', () => {
    expect(FIXTURE.length).toBe(21);
    expect(COLOMBIA.length + FIXTURE.length).toBeGreaterThanOrEqual(40);
  });

  it.each(COLOMBIA)('%s (%d) → %s', (description, pesos, expected) => {
    expect(categorize(tx(description, pesos * 100), ctx)).toEqual({
      categoryId: expected,
      categorySource: 'rule',
    });
  });
});

describe('categorize: the demo fixture', () => {
  it.each(FIXTURE)('%s (%d, %s) → %s', (description, amountMinor, merchant, expected) => {
    expect(categorize(tx(description, amountMinor, merchant), ctx).categoryId).toBe(expected);
  });
});

describe('categorize: pipeline order', () => {
  const coffee = tx('JUAN VALDEZ CAFE', -980_000, 'JUAN VALDEZ');

  it('uses the person category for this bank movement first', () => {
    const c = { ...ctx, txOverrides: new Map([['p-1', 'restaurants' as const]]) };
    expect(categorize(coffee, c)).toEqual({ categoryId: 'restaurants', categorySource: 'user' });
  });

  it('then the person category for the merchant', () => {
    const c = { ...ctx, merchantOverrides: new Map([['juan valdez', 'other' as const]]) };
    expect(categorize(coffee, c)).toEqual({ categoryId: 'other', categorySource: 'user' });
  });

  it('then the merchant catalog of M9, still checking the Antojos threshold', () => {
    const catalog = (key: string) => (key === 'juan valdez' ? ('restaurants' as const) : null);
    expect(categorize(coffee, { ...ctx, catalog }).categoryId).toBe('treats');
    expect(categorize(tx('X', -5_000_000, 'JUAN VALDEZ'), { ...ctx, catalog }).categoryId).toBe(
      'restaurants',
    );
  });

  it('moves food to Antojos only below the threshold the person set', () => {
    const lunch = tx('Almuerzo', -1_800_000);
    expect(categorize(lunch, ctx).categoryId).toBe('treats');
    expect(categorize(lunch, { ...ctx, treatsThresholdMinor: 1_500_000 }).categoryId).toBe(
      'restaurants',
    );
    expect(categorize(tx('Almuerzo', 1_800_000), ctx).categoryId).toBe('restaurants');
  });

  it('gives salary only to money in', () => {
    expect(categorize(tx('NOMINA ACME', -100_000), ctx).categoryId).toBe('other');
  });
});

describe('ruleText', () => {
  it('drops accents, case and signs', () => {
    expect(ruleText('ÉXITO  Calle-80', null, 'Señor*')).toBe('exito calle 80 senor');
  });
});
