import { selectedProvider, type BankProvider } from './provider';

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
