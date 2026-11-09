// The Fynk dialog that replaces the Android Alert.alert (QA review 2026-11-07, V8).
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { uiStrings } from '../strings.es-CO';
import { ThemeProvider } from '../theme';
import { darkColors, lightColors } from '../tokens';
import { DialogHost, dialog } from './Dialog';

const noStore = { load: async () => 'dark' as const, save: async () => {} };

// The queue lives outside React, so every test closes the dialogs it opens.
async function close(label: string) {
  await fireEvent.press(screen.getByRole('button', { name: label }));
}

async function show(...args: Parameters<typeof dialog.show>) {
  await act(async () => dialog.show(...args));
}

it('shows the title, the message and the buttons, and runs the pressed one before closing', async () => {
  await render(<DialogHost />);
  const remove = jest.fn();
  const keep = jest.fn();
  await show('¿Eliminar meta Viaje?', 'Se borra con sus aportes.', [
    { text: 'Cancelar', style: 'cancel', onPress: keep },
    { text: 'Eliminar', style: 'destructive', onPress: remove },
  ]);

  expect(screen.getByRole('header', { name: '¿Eliminar meta Viaje?' })).toBeOnTheScreen();
  expect(screen.getByText('Se borra con sus aportes.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar' }));

  expect(remove).toHaveBeenCalledTimes(1);
  expect(keep).not.toHaveBeenCalled();
  expect(screen.queryByText('¿Eliminar meta Viaje?')).toBeNull();
});

it('puts the cancel button last, below the actions', async () => {
  await render(<DialogHost />);
  await show('¿Cerrar sesión?', undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Cerrar sesión', style: 'destructive' },
  ]);
  const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
  expect(labels.filter((l) => l !== uiStrings.dialogDismiss)).toEqual([
    'Cerrar sesión',
    'Cancelar',
  ]);
  await close('Cancelar');
});

it('draws a destructive action in the danger color', async () => {
  await render(<DialogHost />);
  await show('¿Revocar?', undefined, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Revocar', style: 'destructive' },
  ]);
  expect(screen.getByText('Revocar')).toHaveStyle({ color: lightColors.danger });
  await close('Cancelar');
});

it('without buttons offers "Entendido", which closes it', async () => {
  await render(<DialogHost />);
  await show('Descargar mis datos', 'Te enviaremos un archivo.');
  await fireEvent.press(screen.getByRole('button', { name: uiStrings.dialogOk }));
  expect(screen.queryByText('Descargar mis datos')).toBeNull();
});

it('closing from outside runs the cancel button', async () => {
  await render(<DialogHost />);
  const cancel = jest.fn();
  await show('¿Continuar?', undefined, [
    { text: 'Ahora no', style: 'cancel', onPress: cancel },
    { text: 'Continuar' },
  ]);
  await fireEvent.press(screen.getByRole('button', { name: uiStrings.dialogDismiss }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('¿Continuar?')).toBeNull();
});

it('closing from outside runs onDismiss when there is no cancel button', async () => {
  await render(<DialogHost />);
  const onDismiss = jest.fn();
  await show('¿Continuar?', undefined, [{ text: 'Sí' }, { text: 'No' }], {
    cancelable: true,
    onDismiss,
  });
  await fireEvent.press(screen.getByRole('button', { name: uiStrings.dialogDismiss }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('does not close from outside a choice without a cancel button', async () => {
  await render(<DialogHost />);
  const pick = jest.fn();
  await show('¿Aplicar a todos?', undefined, [
    { text: 'Solo este', onPress: pick },
    { text: 'Todos', onPress: pick },
  ]);
  expect(screen.queryByRole('button', { name: uiStrings.dialogDismiss })).toBeNull();
  expect(screen.getByText('¿Aplicar a todos?')).toBeOnTheScreen();
  await close('Solo este');
});

it('shows a dialog asked for before the host mounts, and queues the next one', async () => {
  dialog.show('Primero');
  dialog.show('Segundo');
  await render(<DialogHost />);
  expect(screen.getByText('Primero')).toBeOnTheScreen();
  expect(screen.queryByText('Segundo')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: uiStrings.dialogOk }));
  expect(screen.getByText('Segundo')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: uiStrings.dialogOk }));
  expect(screen.queryByText('Segundo')).toBeNull();
});

it('is a dark card in dark mode', async () => {
  await render(
    <ThemeProvider initialPreference="dark" store={noStore}>
      <DialogHost />
    </ThemeProvider>,
  );
  await show('Modo oscuro');
  expect(screen.getByTestId('dialog.card')).toHaveStyle({
    backgroundColor: darkColors.background,
  });
  expect(screen.getByText('Modo oscuro')).toHaveStyle({ color: darkColors.textPrimary });
  await close(uiStrings.dialogOk);
});
