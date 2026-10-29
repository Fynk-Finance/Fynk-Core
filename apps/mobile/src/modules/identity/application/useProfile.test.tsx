import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError } from '@shared/api';

import type { Profile } from '../domain/profile';
import type { ProfilePort } from './ports';
import { useProfile } from './useProfile';

const profile: Profile = {
  id: 'sub-1',
  email: 'ca•••@correo.com',
  firstName: 'Camila',
  lastName: 'Rojas',
  emailVerified: true,
  createdAt: '2026-10-20T15:30:00Z',
};

const problem = (status: number, code: string) => new ApiError({ status, code, title: code });

async function setup(getProfile: ProfilePort['getProfile']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const onGone = jest.fn();
  const port: ProfilePort = { getProfile: jest.fn(getProfile) };
  const hook = await renderHook(
    () => {
      const { data, isError, refetch } = useProfile(port, onGone); // read here: the query tracks what a screen reads
      return { data, isError, refetch };
    },
    { wrapper },
  );
  return { ...hook, onGone, port, client };
}

it('returns the profile', async () => {
  const { result, onGone } = await setup(async () => profile);
  await waitFor(() => expect(result.current.data).toEqual(profile));
  expect(result.current.data).toEqual(profile);
  expect(onGone).not.toHaveBeenCalled();
});

it('calls onAccountGone once on profile_not_found and does not retry', async () => {
  const { result, onGone, port, rerender } = await setup(async () => {
    throw problem(404, 'profile_not_found');
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  rerender({});
  expect(onGone).toHaveBeenCalledTimes(1);
  expect(port.getProfile).toHaveBeenCalledTimes(1);
});

it('keeps a 503 as an error to retry, without signing out', async () => {
  let fail = true;
  const { result, onGone, port } = await setup(async () => {
    if (fail) throw problem(503, 'identity_admin_unavailable');
    return profile;
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(port.getProfile).toHaveBeenCalledTimes(2); // first try plus one retry
  expect(onGone).not.toHaveBeenCalled();

  fail = false;
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.data).toEqual(profile));
});

it('treats a network failure as a retryable error', async () => {
  const { result, onGone } = await setup(async () => {
    throw ApiError.network();
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(onGone).not.toHaveBeenCalled();
});

it('drops the profile from the cache once no screen shows it', async () => {
  const { result, unmount, client } = await setup(async () => profile);
  await waitFor(() => expect(result.current.data).toEqual(profile));
  await act(async () => unmount());
  await waitFor(() =>
    expect(client.getQueryCache().find({ queryKey: ['identity', 'profile'] })).toBeUndefined(),
  );
});
