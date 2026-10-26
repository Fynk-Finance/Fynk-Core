import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppRoot } from './AppRoot';
import { notchLeft } from './navigation/TabBar';

describe('AppRoot', () => {
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
});

describe('notchLeft', () => {
  it('matches the design positions on a 390 px bar', () => {
    // VerdeDashboard 20, VerdeBilletera 114.5, VerdeRecomendaciones 209, VerdeInversion 303.5
    expect(notchLeft(390, 4, 0)).toBeCloseTo(20.25, 1);
    expect(notchLeft(390, 4, 1)).toBeCloseTo(114.75, 1);
    expect(notchLeft(390, 4, 2)).toBeCloseTo(209.25, 1);
    expect(notchLeft(390, 4, 3)).toBeCloseTo(303.75, 1);
  });
});
