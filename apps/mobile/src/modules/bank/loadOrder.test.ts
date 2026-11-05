// M5 writes through M6 and M7, and M7 imports M5 for pull to refresh, so the three modules form
// an import cycle. They use each other only inside functions, so the app loads them in any
// order and nothing one module hands another is undefined.
type Loaded = Record<string, unknown>;

const orders: [string, string[]][] = [
  [
    'the registry order (M6, M5, M7)',
    ['@modules/accounts', '@modules/bank', '@modules/transactions'],
  ],
  ['M5 first', ['@modules/bank', '@modules/accounts', '@modules/transactions']],
  ['M7 first', ['@modules/transactions', '@modules/bank', '@modules/accounts']],
];

it.each(orders)('loads M5, M6 and M7 in %s', (_, order) => {
  const loaded: Record<string, Loaded> = {};
  jest.isolateModules(() => {
    for (const name of order) loaded[name] = jest.requireActual<Loaded>(name);
  });

  expect(typeof loaded['@modules/bank']!.syncNow).toBe('function');
  expect(typeof loaded['@modules/bank']!.ConnectBankScreen).toBe('function');
  expect(typeof loaded['@modules/accounts']!.upsertFromSync).toBe('function');
  expect(typeof loaded['@modules/accounts']!.markLinkRevoked).toBe('function');
  expect(typeof loaded['@modules/transactions']!.upsertFromSync).toBe('function');
  expect(loaded['@modules/transactions']!.AllTransactionsScreen).toBeDefined();
});
