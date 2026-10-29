import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AppRoot } from './AppRoot';
import { notchLeft } from './navigation/TabBar';

// The real identity module (M1) keeps its sign-in gate open until there is a session, and it
// talks to Keychain and the system browser. The shell tests use a stand-in whose gate they set.
let mockSignInGateOpen = false;
jest.mock('@modules/identity', () => {
  const { createPlaceholderScreen } = jest.requireActual('@shared/navigation');
  return {
    routes: {
      module: 'identity',
      flow: createPlaceholderScreen({ title: 'Inicio', owner: 'M1 · Identidad' }),
      useGate: () => mockSignInGateOpen,
      screens: [],
    },
  };
});

// The real vault gate (M2) reads the identity session and the Keychain; here it stays closed.
jest.mock('@modules/vault', () => {
  const { createPlaceholderScreen } = jest.requireActual('@shared/navigation');
  return {
    routes: {
      module: 'vault',
      flow: createPlaceholderScreen({ title: 'Desbloquear', owner: 'M2 · Bóveda y respaldo' }),
      useGate: () => false,
      screens: [],
    },
  };
});

beforeEach(() => {
  mockSignInGateOpen = false;
});

describe('AppRoot', () => {
  it('shows the sign-in flow instead of the tabs while its gate is open', async () => {
    mockSignInGateOpen = true;
    await render(<AppRoot />);

    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Dashboard' })).toBeNull();
  });

  it('opens on the Dashboard tab with the four tabs of the design', async () => {
    await render(<AppRoot />);

    for (const label of ['Dashboard', 'Billetera', 'Recomendaciones', 'Inversión']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeSelected();
    expect(screen.getByText('La construye el módulo M6 · Cuentas.')).toBeTruthy();
  });

  it('switches tabs from the tab bar', async () => {
    await render(<AppRoot />);

    await fireEvent.press(screen.getByRole('tab', { name: 'Billetera' }));

    expect(screen.getByRole('tab', { name: 'Billetera' })).toBeSelected();
    expect(
      screen.getByText('La construye el módulo M9 · Gastos recurrentes y suscripciones.'),
    ).toBeTruthy();
  });

  it('switches tabs with a horizontal swipe', async () => {
    await render(<AppRoot />);

    // A swipe ends with the pager settling on a page, as the native pager reports it.
    const [pager] = screen.root!.queryAll((node) => node.type === 'RNCViewPager');
    await act(async () => {
      fireEvent(pager!, 'pageSelected', { nativeEvent: { position: 2 } });
    });

    expect(screen.getByRole('tab', { name: 'Recomendaciones' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Dashboard' })).not.toBeSelected();
  });
});

describe('notchLeft', () => {
  it('matches the design positions on a 390 px bar', () => {
    // VerdeDashboard 20, VerdeBilletera 114.5, VerdeRecomendaciones 209, VerdeInversion 303.5
    expect(notchLeft(390, 4, 0)).toBeCloseTo(20.25, 1);
    expect(notchLeft(390, 4, 1)).toBeCloseTo(114.75, 1);
    expect(notchLeft(390, 4, 2)).toBeCloseTo(209.25, 1);
    expect(notchLeft(390, 4, 3)).toBeCloseTo(303.75, 1);
  });

  it('moves the notch halfway while the page is halfway through a swipe', () => {
    expect(notchLeft(390, 4, 1.5)).toBeCloseTo((114.75 + 209.25) / 2, 1);
  });
});
