// The installed screen greets the person with M3's name and "Programar" opens M8's reminder.
import { screen } from '@testing-library/react-native';

jest.mock('@modules/onboarding', () => ({ useDisplayName: jest.fn(() => 'Julián') }));
jest.mock('@modules/savings', () => ({ openPaydayReminder: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports -- the mocks above must load first */
const onboarding = jest.requireMock<{ useDisplayName: jest.Mock }>('@modules/onboarding');
const { routes } = require('./index') as typeof import('./index');
const { renderScreens } =
  require('./testing/renderScreen') as typeof import('./testing/renderScreen');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('recommendations header', () => {
  it('greets the person with the name typed in onboarding (M3)', async () => {
    await renderScreens({ screens: { Recomendaciones: routes.tab! }, initial: 'Recomendaciones' });
    expect(await screen.findByText('Julián')).toBeOnTheScreen();
  });

  it('shows "Invitado" before the person types a name', async () => {
    onboarding.useDisplayName.mockReturnValue(null);
    await renderScreens({ screens: { Recomendaciones: routes.tab! }, initial: 'Recomendaciones' });
    expect(await screen.findByText('Invitado')).toBeOnTheScreen();
  });
});
