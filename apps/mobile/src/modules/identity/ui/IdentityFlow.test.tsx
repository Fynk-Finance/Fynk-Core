// HU-001 and HU-002: a signed out user lands on Inicio, "Empezar" opens registration and
// "Ya tengo cuenta" opens sign in; a cancel shows nothing, a failure shows why.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { SessionService, SessionState } from '../application/sessionService';
import { createIdentityFlow } from './IdentityFlow';
import { identityStrings } from './strings.es-CO';

const t = identityStrings.inicio;

function fakeSession(initial: SessionState['status'] = 'restoring') {
  let state: SessionState = { status: initial, busy: false, error: null };
  const listeners = new Set<() => void>();
  const session: SessionService = {
    getState: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    restore: jest.fn(async () => undefined),
    signIn: jest.fn(async () => undefined),
    signUp: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    changePassword: jest.fn(async () => 'cancelled' as const),
    getAccessToken: jest.fn(async () => null),
    refreshAccessToken: jest.fn(async () => false),
  };
  const set = (next: Partial<SessionState>) =>
    act(async () => {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    });
  return { session, set };
}

it('shows a loader while the stored session is read, then Inicio', async () => {
  const { session, set } = fakeSession();
  const Flow = createIdentityFlow(session);
  await render(<Flow />);
  expect(session.restore).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('identity.restoring')).toBeTruthy();

  await set({ status: 'signedOut' });
  expect(screen.queryByTestId('identity.restoring')).toBeNull();
  expect(screen.getByText(t.subtitle)).toBeTruthy();
  expect(screen.getByText(t.titleHighlight)).toBeTruthy();
  expect(screen.getByLabelText(t.illustration)).toBeTruthy();
});

it('opens registration from Empezar and sign in from Ya tengo cuenta', async () => {
  const { session } = fakeSession('signedOut');
  const Flow = createIdentityFlow(session);
  await render(<Flow />);

  await fireEvent.press(screen.getByTestId('identity.inicio.start'));
  expect(session.signUp).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText(t.signIn));
  expect(session.signIn).toHaveBeenCalledTimes(1);
});

it('blocks both buttons while the browser is open', async () => {
  const { session, set } = fakeSession('signedOut');
  const Flow = createIdentityFlow(session);
  await render(<Flow />);
  await set({ busy: true });

  await fireEvent.press(screen.getByTestId('identity.inicio.start'));
  await fireEvent.press(screen.getByTestId('identity.inicio.signIn'));
  expect(session.signUp).not.toHaveBeenCalled();
  expect(session.signIn).not.toHaveBeenCalled();
});

it('shows nothing after a cancel and the reason after a failure', async () => {
  const { session, set } = fakeSession('signedOut');
  const Flow = createIdentityFlow(session);
  await render(<Flow />);
  expect(screen.queryByTestId('identity.inicio.error')).toBeNull();

  await set({ error: 'network' });
  expect(screen.getByText(t.errors.network)).toBeTruthy();

  await set({ error: 'unknown' });
  expect(screen.getByText(t.errors.unknown)).toBeTruthy();
});
