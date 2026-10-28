import { api, unwrap } from '@shared/api';

import type { ProfilePort } from '../application/ports';

/** Reads the profile from `GET /me` with the shared API client. */
export function createProfileApi(): ProfilePort {
  return {
    async getProfile() {
      const me = await unwrap(api.GET('/me'));
      return {
        id: me.id,
        email: me.email,
        firstName: me.firstName,
        lastName: me.lastName,
        emailVerified: me.emailVerified,
        createdAt: me.createdAt,
      };
    },
  };
}
