// A fake of the consents API port for this module's tests. Calls without an override fail, so a
// test notices when the code reaches an endpoint it did not expect.
import type { ConsentsApiPort } from '../application/ports';

const unexpected = (name: string) => async () => {
  throw new Error(`Unexpected call to ${name}`);
};

export function fakeConsentsApi(overrides: Partial<ConsentsApiPort> = {}) {
  return {
    currentText: jest.fn(overrides.currentText ?? unexpected('currentText')),
    create: jest.fn(overrides.create ?? unexpected('create')),
    list: jest.fn(overrides.list ?? unexpected('list')),
    get: jest.fn(overrides.get ?? unexpected('get')),
    revoke: jest.fn(overrides.revoke ?? unexpected('revoke')),
    entityNames: jest.fn(overrides.entityNames ?? unexpected('entityNames')),
  } satisfies ConsentsApiPort;
}
