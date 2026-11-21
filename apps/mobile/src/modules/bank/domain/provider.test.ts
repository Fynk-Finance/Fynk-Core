import { selectedProvider, visibleProviders, type BankProvider } from './provider';

const bancoDemo: BankProvider = {
  id: 'banco-demo',
  displayName: 'Banco Demo',
  kind: 'bank',
  isSimulated: true,
  supportedScopes: ['balances', 'transactions', 'account_details'],
  logoKey: 'banco-demo',
};
const billeteraDemo: BankProvider = {
  ...bancoDemo,
  id: 'billetera-demo',
  displayName: 'Billetera Demo',
  kind: 'wallet',
  logoKey: 'billetera-demo',
};

describe('selectedProvider', () => {
  it('returns the chosen entity', () => {
    expect(selectedProvider([bancoDemo, billeteraDemo], 'billetera-demo')).toBe(billeteraDemo);
  });

  it('starts with the first entity of the list', () => {
    expect(selectedProvider([bancoDemo, billeteraDemo], null)).toBe(bancoDemo);
  });

  it('falls back to the first one when the chosen entity is no longer listed', () => {
    expect(selectedProvider([bancoDemo], 'bancolombia')).toBe(bancoDemo);
  });

  it('returns nothing for an empty list', () => {
    expect(selectedProvider([], null)).toBeUndefined();
  });
});

describe('visibleProviders', () => {
  const digital: BankProvider = {
    ...bancoDemo,
    id: 'banco-digital-demo',
    logoKey: 'banco-digital-demo',
  };
  const coop: BankProvider = { ...bancoDemo, id: 'cooperativa-demo', logoKey: 'cooperativa-demo' };
  // Bancolombia's sandbox is flagged simulated by the API, but it is a real provider.
  const bancolombia: BankProvider = { ...bancoDemo, id: 'bancolombia', logoKey: 'bancolombia' };
  const all = [bancoDemo, billeteraDemo, digital, coop, bancolombia];

  it('keeps the simulated entities the person has accounts in, and every real provider', () => {
    const ids = visibleProviders(all, ['banco-demo', 'cooperativa-demo']).map((p) => p.id);
    expect(ids).toEqual(['banco-demo', 'cooperativa-demo', 'bancolombia']);
  });

  it('shows every entity when the list of the person is unknown', () => {
    expect(visibleProviders(all, null)).toEqual(all);
  });
});
