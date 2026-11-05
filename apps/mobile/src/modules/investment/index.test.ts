// The module installs itself from index.ts with M6's CDTs (SCRUM-66): the Inversión tab shows the
// user's own CDTs and their total over time, and "+ Invertir" opens the Banco Demo portal.
jest.mock('@modules/accounts', () => ({
  getCdtAccounts: jest.fn(),
  getBalanceHistory: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports -- the mock above must load first */
const accounts = jest.requireMock<{ getCdtAccounts: jest.Mock; getBalanceHistory: jest.Mock }>(
  '@modules/accounts',
);
const { cdtAccounts, routes } = require('./index') as typeof import('./index');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('investment module wiring', () => {
  it('exports the Inversión tab', () => {
    expect(routes.module).toBe('investment');
    expect(typeof routes.tab).toBe('function');
  });

  it('reads the CDTs of M6 and totals their balances per day for the chart', async () => {
    accounts.getCdtAccounts.mockResolvedValue([{ id: 'cdt-1' }, { id: 'cdt-2' }]);
    accounts.getBalanceHistory.mockResolvedValue([
      { accountId: 'cdt-1', onDate: '2026-10-01', balanceMinor: 100_000_000 },
      { accountId: 'cdt-2', onDate: '2026-10-01', balanceMinor: 50_000_000 },
    ]);
    expect(await cdtAccounts.getCdtBalanceHistory!()).toEqual([
      { date: '2026-10-01', balanceMinor: 150_000_000 },
    ]);
    expect(accounts.getBalanceHistory).toHaveBeenCalledWith(['cdt-1', 'cdt-2'], '2000-01-01');
  });

  it('asks M6 for no history when the user has no CDTs', async () => {
    accounts.getCdtAccounts.mockResolvedValue([]);
    accounts.getBalanceHistory.mockClear();
    expect(await cdtAccounts.getCdtBalanceHistory!()).toEqual([]);
    expect(accounts.getBalanceHistory).not.toHaveBeenCalled();
  });
});
