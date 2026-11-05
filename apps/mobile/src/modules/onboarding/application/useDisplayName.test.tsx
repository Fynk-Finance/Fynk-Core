// The name typed in onboarding, read by the Dashboard greeting (SCRUM-69).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { NamePort } from './ports';
import { createDisplayName, displayNameQueryKey } from './useDisplayName';

const clients: QueryClient[] = [];
afterEach(() => {
  for (const c of clients.splice(0)) c.clear();
});

function setup(getName: NamePort['getName'], user: { id: string | null } = { id: 'user-1' }) {
  const names: NamePort = { getName: jest.fn(getName), saveName: jest.fn(async () => undefined) };
  // No garbage collection timer, so Jest exits cleanly.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { names, client, wrapper, ...createDisplayName(names, () => user.id) };
}

describe('useDisplayName', () => {
  it('gives the full saved name', async () => {
    const { wrapper, useDisplayName } = setup(async () => ({
      firstName: 'Laura',
      lastName: 'Gómez Ruiz',
    }));
    const { result } = await renderHook(() => useDisplayName(), { wrapper });
    await waitFor(() => expect(result.current).toBe('Laura Gómez Ruiz'));
  });

  it('gives null while it loads and when there is no name', async () => {
    let resolve: (name: { firstName?: string }) => void = () => undefined;
    const { wrapper, useDisplayName } = setup(
      () => new Promise((r) => (resolve = r as typeof resolve)),
    );
    const { result } = await renderHook(() => useDisplayName(), { wrapper });
    expect(result.current).toBeNull();
    await act(async () => resolve({}));
    expect(result.current).toBeNull();
  });

  it('gives null when the profile cannot be read', async () => {
    const { wrapper, useDisplayName, client } = setup(async () => {
      throw new Error('offline');
    });
    const { result } = await renderHook(() => useDisplayName(), { wrapper });
    await waitFor(() =>
      expect(client.getQueryState(displayNameQueryKey('user-1'))?.status).toBe('error'),
    );
    expect(result.current).toBeNull();
  });

  it('does not ask for a name while signed out', async () => {
    const { wrapper, useDisplayName, names } = setup(async () => ({ firstName: 'Laura' }), {
      id: null,
    });
    const { result } = await renderHook(() => useDisplayName(), { wrapper });
    expect(result.current).toBeNull();
    expect(names.getName).not.toHaveBeenCalled();
  });

  it('keeps the name of each account apart', async () => {
    const user = { id: 'user-1' as string | null };
    const { wrapper, useDisplayName, client } = setup(async () => ({ firstName: 'Laura' }), user);
    await renderHook(() => useDisplayName(), { wrapper });
    await waitFor(() => expect(client.getQueryData(displayNameQueryKey('user-1'))).toBe('Laura'));
    expect(client.getQueryData(displayNameQueryKey('user-2'))).toBeUndefined();
  });

  it('shows a name just saved on the first render, before the profile answers', async () => {
    const { wrapper, useDisplayName, useRememberName } = setup(() => new Promise(() => undefined));
    // Nombre saves the name; the Dashboard mounts later, when the setup ends.
    const saved = await renderHook(() => useRememberName(), { wrapper });
    await act(async () => saved.result.current({ firstName: 'Laura', lastName: 'Gómez' }));
    const { result } = await renderHook(() => useDisplayName(), { wrapper });
    expect(result.current).toBe('Laura Gómez');
  });
});
