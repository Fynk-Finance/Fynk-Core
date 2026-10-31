// Recovery code screen: the five groups, copy, "Ya lo guardé", the last group check. Light and dark.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import type { ConfirmResult } from '../application/recoveryCode';
import { RecoveryCodeScreen } from './RecoveryCodeScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.recovery;
const noStore = { load: async () => 'system' as const, save: async () => undefined };
const GROUPS = ['0A1B2', 'C3D4E', 'F5G6H', 'J7K8M', 'N9P0QR'];

function Probe() {
  const { colors } = useTheme();
  return <Text testID="probe.surface">{colors.surfaceBlue}</Text>;
}

async function renderScreen(
  options: {
    preference?: ThemePreference;
    result?: ConfirmResult | Error;
    copy?: Error;
    onClose?: () => void;
  } = {},
) {
  const onConfirm = jest.fn(async (_typed: string): Promise<ConfirmResult> => {
    if (options.result instanceof Error) throw options.result;
    return options.result ?? 'ok';
  });
  const copyText = jest.fn(async (_text: string) => {
    if (options.copy) throw options.copy;
    return true;
  });
  await render(
    <ThemeProvider initialPreference={options.preference ?? 'light'} store={noStore}>
      <Probe />
      <RecoveryCodeScreen
        groups={GROUPS}
        onConfirm={onConfirm}
        copyText={copyText}
        onClose={options.onClose}
      />
    </ThemeProvider>,
  );
  return { onConfirm, copyText };
}

const goToConfirm = () => fireEvent.press(screen.getByRole('button', { name: t.saved }));
const type = (text: string) =>
  fireEvent.changeText(screen.getByTestId('vault.recovery.confirmInput'), text);
const confirm = () => fireEvent.press(screen.getByRole('button', { name: t.confirm }));

describe('step 1', () => {
  it('shows the title, the five groups, the warning and the buttons', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: t.title })).toBeOnTheScreen();
    GROUPS.forEach((group, i) => {
      expect(screen.getByTestId(`vault.recovery.group.${i}`)).toHaveTextContent(group);
    });
    expect(screen.getByText(t.warning)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t.copy })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t.saved })).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.recovery.confirmInput')).toBeNull();
  });

  it('copies the code in groups and says Copiado', async () => {
    const { copyText } = await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: t.copy }));
    expect(copyText).toHaveBeenCalledWith('0A1B2 C3D4E F5G6H J7K8M N9P0QR');
    expect(screen.getByRole('button', { name: t.copied })).toBeOnTheScreen();
  });

  it('goes back to Copiar after a moment', async () => {
    jest.useFakeTimers();
    try {
      await renderScreen();
      await fireEvent.press(screen.getByRole('button', { name: t.copy }));
      expect(screen.getByRole('button', { name: t.copied })).toBeOnTheScreen();
      await act(async () => jest.advanceTimersByTime(2500));
      expect(screen.getByRole('button', { name: t.copy })).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not say Copiado when the clipboard fails', async () => {
    await renderScreen({ copy: new Error('clipboard') });
    await fireEvent.press(screen.getByRole('button', { name: t.copy }));
    expect(screen.queryByRole('button', { name: t.copied })).toBeNull();
  });

  it('shows a close button only when the screen is pushed', async () => {
    const onClose = jest.fn();
    await renderScreen({ onClose });
    await fireEvent.press(screen.getByRole('button', { name: t.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await screen.unmount();
    await renderScreen();
    expect(screen.queryByRole('button', { name: t.close })).toBeNull();
  });
});

describe('step 2', () => {
  it('asks for the last group with an accessible, uppercase, no-autocorrect input', async () => {
    await renderScreen();
    await goToConfirm();
    expect(screen.getByRole('header', { name: t.confirmTitle })).toBeOnTheScreen();
    const input = screen.getByTestId('vault.recovery.confirmInput');
    expect(input.props.accessibilityLabel).toBe(t.inputLabel);
    expect(input.props.autoCapitalize).toBe('characters');
    expect(input.props.autoCorrect).toBe(false);
    expect(screen.queryByTestId('vault.recovery.group.0')).toBeNull();
  });

  it('keeps Confirmar off until something is typed', async () => {
    await renderScreen();
    await goToConfirm();
    expect(screen.getByRole('button', { name: t.confirm }).props.accessibilityState.disabled).toBe(
      true,
    );
    await type('N9P0QR');
    expect(screen.getByRole('button', { name: t.confirm }).props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('sends what was typed on Confirmar', async () => {
    const { onConfirm } = await renderScreen();
    await goToConfirm();
    await type('n9p0qr');
    await confirm();
    expect(onConfirm).toHaveBeenCalledWith('n9p0qr');
    expect(screen.queryByText(t.errors.mismatch)).toBeNull();
  });

  it('shows the mismatch message and clears it when the person types again', async () => {
    await renderScreen({ result: 'mismatch' });
    await goToConfirm();
    await type('XXXXXX');
    await confirm();
    expect(screen.getByText(t.errors.mismatch)).toBeOnTheScreen();
    await type('XXXXXY');
    expect(screen.queryByText(t.errors.mismatch)).toBeNull();
  });

  it('shows a retry message when offline, and the same button retries', async () => {
    const { onConfirm } = await renderScreen({ result: 'offline' });
    await goToConfirm();
    await type('N9P0QR');
    await confirm();
    expect(screen.getByText(t.errors.offline)).toBeOnTheScreen();
    await confirm();
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('shows a generic message when the upload fails or throws', async () => {
    await renderScreen({ result: 'failed' });
    await goToConfirm();
    await type('N9P0QR');
    await confirm();
    expect(screen.getByText(t.errors.failed)).toBeOnTheScreen();
    await screen.unmount();

    await renderScreen({ result: new Error('boom') });
    await goToConfirm();
    await type('N9P0QR');
    await confirm();
    expect(screen.getByText(t.errors.failed)).toBeOnTheScreen();
  });

  it('can go back to see the code again', async () => {
    await renderScreen();
    await goToConfirm();
    await fireEvent.press(screen.getByRole('button', { name: t.seeCode }));
    expect(screen.getByTestId('vault.recovery.group.4')).toHaveTextContent('N9P0QR');
  });
});

it.each(['light', 'dark'] as const)('draws both steps in the %s theme', async (preference) => {
  await renderScreen({ preference });
  expect(screen.getByTestId('vault.recovery.card')).toBeOnTheScreen();
  await goToConfirm();
  expect(screen.getByTestId('vault.recovery.confirmInput')).toBeOnTheScreen();
});

it('uses different surface colors in light and dark', async () => {
  await renderScreen({ preference: 'light' });
  const light = String(screen.getByTestId('probe.surface').props.children);
  await screen.unmount();
  await renderScreen({ preference: 'dark' });
  expect(String(screen.getByTestId('probe.surface').props.children)).not.toBe(light);
});
