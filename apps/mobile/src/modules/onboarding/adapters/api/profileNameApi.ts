// The person's name through the identity API contract (GET and PATCH /me, owned by M1), with the
// shared client. Only the name fields are read; the masked email and the rest stay with M1.
import { api, unwrap } from '@shared/api';

import type { NamePort } from '../../application/ports';

export function createProfileNameApi(): NamePort {
  return {
    async getName() {
      const me = await unwrap(api.GET('/me'));
      return {
        ...(me.firstName ? { firstName: me.firstName } : null),
        ...(me.lastName ? { lastName: me.lastName } : null),
      };
    },

    async saveName({ firstName, lastName }) {
      await unwrap(api.PATCH('/me', { body: { firstName, ...(lastName ? { lastName } : null) } }));
    },
  };
}
