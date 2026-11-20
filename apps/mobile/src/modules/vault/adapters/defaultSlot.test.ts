import { userId } from '@modules/identity';

import { vaultSlot } from '../domain/vaultSlot';
import { currentSlot, rememberAccount, removalSlot } from './defaultSlot';

jest.mock('@modules/identity', () => ({ userId: jest.fn() }));

const mockedUserId = jest.mocked(userId);

it('is null with no account and nothing remembered', () => {
  mockedUserId.mockReturnValue(null);
  expect(currentSlot()).toBeNull();
  expect(removalSlot()).toBeNull();
});

it('removalSlot keeps the last account after sign out, while currentSlot is null', () => {
  mockedUserId.mockReturnValue('user-a');
  expect(currentSlot()).toBe(vaultSlot('user-a'));
  mockedUserId.mockReturnValue(null);
  expect(currentSlot()).toBeNull();
  expect(removalSlot()).toBe(vaultSlot('user-a'));
});

it('removalSlot prefers the current account', () => {
  mockedUserId.mockReturnValue('user-b');
  expect(removalSlot()).toBe(vaultSlot('user-b'));
});

it('rememberAccount sets the removal slot', () => {
  mockedUserId.mockReturnValue(null);
  rememberAccount('user-c');
  expect(removalSlot()).toBe(vaultSlot('user-c'));
  expect(currentSlot()).toBeNull();
});
