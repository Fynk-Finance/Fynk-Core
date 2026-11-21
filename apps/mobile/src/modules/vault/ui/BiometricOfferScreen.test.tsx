// The one-time offer after a password unlock: "Activar" asks the system, "Ahora no" just goes on.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { EnableBiometricsResult } from '../application/lockController';
import { BiometricOfferScreen } from './BiometricOfferScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.biometric;

async function renderOffer(result: EnableBiometricsResult | Error = 'enabled') {
  const onEnable = jest.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  const onDone = jest.fn();
  await render(<BiometricOfferScreen onEnable={onEnable} onDone={onDone} />);
  return { onEnable, onDone };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

it('asks and says where to change it later, with the illustration', async () => {
  await renderOffer();
  expect(screen.getByRole('header', { name: t.offer.title })).toBeOnTheScreen();
  expect(screen.getByText(t.offer.subtitle)).toBeOnTheScreen();
  expect(screen.getByTestId('vault.lock.illustration')).toBeOnTheScreen();
});

it('goes on once biometrics are on', async () => {
  const { onEnable, onDone } = await renderOffer('enabled');
  await press(t.offer.enable);
  expect(onEnable).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
});

it('"Ahora no" goes on without asking the system', async () => {
  const { onEnable, onDone } = await renderOffer();
  await press(t.offer.later);
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onEnable).not.toHaveBeenCalled();
});

it('stays when the system prompt is cancelled, with no error', async () => {
  const { onDone } = await renderOffer('cancelled');
  await press(t.offer.enable);
  expect(onDone).not.toHaveBeenCalled();
  expect(screen.queryByText(t.failed)).toBeNull();
});

it.each([
  ['fails', 'failed' as const],
  ['throws', new Error('keychain')],
])('shows an error and stays when it %s', async (_name, result) => {
  const { onDone } = await renderOffer(result);
  await press(t.offer.enable);
  expect(await screen.findByText(t.failed)).toBeOnTheScreen();
  expect(onDone).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: t.offer.later })).toBeOnTheScreen();
});
