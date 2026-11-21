import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Slot, registerSlot } from './slots';

describe('Slot', () => {
  it('renders nothing until a module registers the section', async () => {
    await render(<Slot name="miCuenta.misCuentas" />);
    expect(screen.toJSON()).toBeNull();
  });

  it('renders the section the owning module registered', async () => {
    registerSlot('miCuenta.misCuentas', () => <Text>Mis cuentas</Text>);
    await render(<Slot name="miCuenta.misCuentas" />);
    expect(screen.getByText('Mis cuentas')).toBeTruthy();
  });
});
