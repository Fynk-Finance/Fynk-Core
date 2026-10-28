import { isApiError } from '@shared/api';

import { createProfileApi } from './profileApi';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

afterEach(() => jest.restoreAllMocks());

it('maps GET /me to the profile, keeping the email masked as it comes', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    json(200, {
      id: 'sub-1',
      email: 'ca•••@correo.com',
      firstName: 'Camila',
      lastName: 'Rojas',
      emailVerified: true,
      createdAt: '2026-10-20T15:30:00Z',
      passwordUpdatedAt: '2026-10-20T15:32:10Z',
    }),
  );
  await expect(createProfileApi().getProfile()).resolves.toEqual({
    id: 'sub-1',
    email: 'ca•••@correo.com',
    firstName: 'Camila',
    lastName: 'Rojas',
    emailVerified: true,
    createdAt: '2026-10-20T15:30:00Z',
  });
});

it('throws the problem code of a failed call', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    json(404, {
      type: '/problems/profile_not_found',
      title: 'Profile not found',
      status: 404,
      code: 'profile_not_found',
    }),
  );
  const error = await createProfileApi()
    .getProfile()
    .catch((e: unknown) => e);
  expect(isApiError(error) && error.code).toBe('profile_not_found');
});
