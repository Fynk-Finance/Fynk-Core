// Contract test of the name calls on /me (contracts/modules/identity.yaml) with a mocked fetch.
import { isApiError } from '@shared/api';

import { createProfileNameApi } from './profileNameApi';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

const profile = {
  id: 'sub-1',
  email: 'la•••@correo.com',
  emailVerified: true,
  createdAt: '2026-10-29T15:00:00Z',
};

afterEach(() => jest.restoreAllMocks());

describe('getName', () => {
  it('reads only the name fields of GET /me', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(200, { ...profile, firstName: 'Laura', lastName: 'Gómez' }));
    await expect(createProfileNameApi().getName()).resolves.toEqual({
      firstName: 'Laura',
      lastName: 'Gómez',
    });
  });

  it('is empty when the person has no name yet', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, profile));
    await expect(createProfileNameApi().getName()).resolves.toEqual({});
  });
});

describe('saveName', () => {
  it('sends the first and last name in the body of PATCH /me', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(200, { ...profile, firstName: 'Laura', lastName: 'Gómez Ruiz' }));
    await createProfileNameApi().saveName({ firstName: 'Laura', lastName: 'Gómez Ruiz' });

    const request = fetch.mock.calls[0]?.[0] as Request;
    expect(request.method).toBe('PATCH');
    expect(new URL(request.url).pathname).toMatch(/\/me$/);
    expect(new URL(request.url).search).toBe('');
    expect(await request.json()).toEqual({ firstName: 'Laura', lastName: 'Gómez Ruiz' });
  });

  it('sends only the first name when there is no last name', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(200, { ...profile, firstName: 'Laura' }));
    await createProfileNameApi().saveName({ firstName: 'Laura' });
    expect(await (fetch.mock.calls[0]?.[0] as Request).json()).toEqual({ firstName: 'Laura' });
  });

  it('throws invalid_profile when the API refuses the name', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(400, {
        type: '/problems/invalid_profile',
        title: 'Invalid profile',
        status: 400,
        code: 'invalid_profile',
      }),
    );
    const error = await createProfileNameApi()
      .saveName({ firstName: 'Laura' })
      .catch((e: unknown) => e);
    expect(isApiError(error) && error.code).toBe('invalid_profile');
  });
});
