// The wiring of the savings module with the modules around it: what happens after a restore
// from the encrypted backup (HU-045, SCRUM-53) and when Ajustes de notificaciones change.
import type { NotifyInput, ScheduleInput } from '@shared/ports';
import {
  createInMemoryBackupRegistry,
  createInMemoryVault,
  type InMemoryVault,
} from '@shared/testing';

const mockBackup = createInMemoryBackupRegistry();
const mockVault: { db?: InMemoryVault['db']; register: jest.Mock } = { register: jest.fn() };
const mockNotices: NotifyInput[] = [];
const mockScheduled: ScheduleInput[] = [];
const mockSettingsListeners: (() => void)[] = [];

jest.mock('@modules/vault', () => ({
  registerVaultMigrations: (...args: unknown[]) => mockVault.register(...args),
  getVaultDb: () => mockVault.db,
  registerBackupCollection: (...args: Parameters<typeof mockBackup.registerBackupCollection>) =>
    mockBackup.registerBackupCollection(...args),
  markDirty: (collection: string, id: string) => mockBackup.markDirty(collection, id),
}));
jest.mock('@modules/notifications', () => ({
  notificationsPort: {
    notify: async (input: NotifyInput) => {
      mockNotices.push(input);
    },
    schedule: async (input: ScheduleInput) => {
      mockScheduled.push(input);
    },
    cancel: async () => undefined,
  },
  onNotificationSettingsChanged: (listener: () => void) => {
    mockSettingsListeners.push(listener);
    return () => undefined;
  },
}));
jest.mock('@modules/analytics', () => ({
  getMonthSummary: async () => ({ incomeMinor: 0 }),
  getRecurringIncome: async () => [],
}));
jest.mock('@modules/transactions', () => ({
  getTransactionsBetween: async () => [],
  setTransactionGoal: async () => undefined,
}));

let vault: InMemoryVault;
let savings: typeof import('./index');

/** Lets the work started by an event or a listener finish. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

beforeAll(async () => {
  vault = await createInMemoryVault();
  mockVault.db = vault.db;
  // Loaded here, after the mocks exist: index.ts registers its tables and collections on load.
  savings = jest.requireActual<typeof import('./index')>('./index');
  const [, migrations] = (mockVault.register.mock.calls as [string, never][]).find(
    ([module]) => module === 'savings',
  )!;
  vault.registerMigrations('savings', migrations);
  await vault.migrate();
});

afterAll(() => vault.close());

const goal = {
  id: 'goal-1',
  version: 1,
  deleted: false,
  data: {
    name: 'Viaje a Cartagena',
    category: 'travel',
    targetMinor: 500_000_000,
    deadline: '2099-06',
    createdAt: '2026-10-01T15:00:00.000Z',
    deletedAt: null,
  },
};
const contribution = {
  id: 'contribution-1',
  version: 1,
  deleted: false,
  data: {
    goalId: 'goal-1',
    amountMinor: 400_000_000, // 80 % of the goal
    contributedOn: '2026-10-20',
    source: 'manual',
    transactionId: null,
    note: null,
    deletedAt: null,
  },
};

it('does not notice again the milestones a restored goal had already reached', async () => {
  await mockBackup.importAll({
    'savings.goals': [goal],
    'savings.contributions': [contribution],
  });
  await settle();

  expect((await savings.getGoals())[0]).toMatchObject({ id: 'goal-1', percent: 80 });
  expect(mockNotices).toEqual([]);
});

it('schedules the payday reminders again when Ajustes de notificaciones change', async () => {
  await vault.db.execute(
    `INSERT INTO savings_payday_reminders (goal_id, amount_minor, day, updated_at)
     VALUES ('goal-1', 30000000, 15, '2026-10-20T15:00:00.000Z')`,
  );
  expect(mockSettingsListeners).toHaveLength(1);

  mockSettingsListeners[0]!();
  await settle();

  expect(mockScheduled.map((r) => r.id)).toEqual(['savings.payday.goal-1']);
});
