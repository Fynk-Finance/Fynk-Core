import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { LinkedDeviceItem } from '../domain/deviceList';
import { DevicesError, type LinkedDevicesApiPort } from './ports';
import { useLinkedDevices } from './useLinkedDevices';

const device = (id: string, lastSeenAt: string, current = false): LinkedDeviceItem => ({
  id,
  name: `Phone ${id}`,
  platform: 'android',
  status: 'active',
  current,
  lastSeenAt,
});

const devices = [
  device('old', '2026-10-01T00:00:00Z'),
  device('this', '2026-09-01T00:00:00Z', true),
];

async function setup(overrides: Partial<LinkedDevicesApiPort> = {}, id: string | null = 'this') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  let currentId = id;
  const api = {
    list: jest.fn(async (_id: string | null) => devices),
    remove: jest.fn(async (_id: string) => undefined),
    signOutOthers: jest.fn(async (_id: string) => undefined),
    ...overrides,
  };
  const sync = jest.fn(async () => {
    currentId ??= 'registered';
  });
  const hook = await renderHook(
    () => {
      const { query, ...rest } = useLinkedDevices({ api, deviceId: () => currentId, sync });
      return { data: query.data, isError: query.isError, ...rest };
    },
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.data).toBeDefined());
  return { ...hook, api, sync };
}

it('lists the devices with this phone first and sends its id', async () => {
  const { result, api } = await setup();
  expect(result.current.data?.map((d) => d.id)).toEqual(['this', 'old']);
  expect(api.list).toHaveBeenCalledWith('this');
});

it('removes a device and loads the list again', async () => {
  const { result, api } = await setup();
  let outcome;
  await act(async () => {
    outcome = await result.current.remove('old');
  });
  expect(outcome).toBe('done');
  expect(api.remove).toHaveBeenCalledWith('old');
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
});

it('reports failed when removing fails and keeps the list', async () => {
  const { result } = await setup({
    remove: jest.fn(async () => {
      throw new DevicesError('network');
    }),
  });
  let outcome;
  await act(async () => {
    outcome = await result.current.remove('old');
  });
  expect(outcome).toBe('failed');
  expect(result.current.data).toHaveLength(2);
});

it('signs out the others with the id of this phone', async () => {
  const { result, api, sync } = await setup();
  let outcome;
  await act(async () => {
    outcome = await result.current.signOutOthers();
  });
  expect(outcome).toBe('done');
  expect(api.signOutOthers).toHaveBeenCalledWith('this');
  expect(sync).not.toHaveBeenCalled();
});

it('registers first when this phone has no id yet', async () => {
  const { result, api, sync } = await setup({}, null);
  await act(async () => {
    await result.current.signOutOthers();
  });
  expect(sync).toHaveBeenCalledTimes(1);
  expect(api.signOutOthers).toHaveBeenCalledWith('registered');
});

it.each([
  ['removed', 'removed'],
  ['notFound', 'failed'],
] as const)('syncs the device when sign out others says %s', async (kind, expected) => {
  const { result, sync } = await setup({
    signOutOthers: jest.fn(async () => {
      throw new DevicesError(kind);
    }),
  });
  let outcome;
  await act(async () => {
    outcome = await result.current.signOutOthers();
  });
  expect(outcome).toBe(expected);
  expect(sync).toHaveBeenCalledTimes(1);
});

it('reports failed without syncing for other errors', async () => {
  const { result, sync } = await setup({
    signOutOthers: jest.fn(async () => {
      throw new DevicesError('network');
    }),
  });
  let outcome;
  await act(async () => {
    outcome = await result.current.signOutOthers();
  });
  expect(outcome).toBe('failed');
  expect(sync).not.toHaveBeenCalled();
  expect(result.current.data).toHaveLength(2);
});
