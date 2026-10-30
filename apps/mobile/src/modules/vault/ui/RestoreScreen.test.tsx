// Restore screen: every state, in light and dark.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import type { ApprovalCheck, ApprovalStart } from '../application/restoreWithApproval';
import type { RestoreFailure } from '../application/restoreWithCode';
import { RestoreScreen } from './RestoreScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.restore;
const noStore = { load: async () => 'system' as const, save: async () => undefined };

function Probe() {
  const { colors } = useTheme();
  return <Text testID="probe.background">{colors.background}</Text>;
}

const STARTED: ApprovalStart = {
  status: 'started',
  id: 'req-1',
  code: '048291',
  expiresAt: '2026-10-30T10:10:00Z',
};

interface Props {
  restoring?: boolean;
  error?: RestoreFailure;
  deviceStatus?: 'pending' | 'active';
  start?: ApprovalStart;
  /** Each poll takes the next answer; the last one repeats. */
  checks?: ApprovalCheck[];
}

interface Handlers {
  onRestore: jest.Mock;
  onSignOut: jest.Mock;
  onStartApproval: jest.Mock<Promise<ApprovalStart>, []>;
  onCheckApproval: jest.Mock<Promise<ApprovalCheck>, [string]>;
}

function build(props: Props, preference: ThemePreference, handlers: Handlers) {
  return (
    <ThemeProvider initialPreference={preference} store={noStore}>
      <Probe />
      <RestoreScreen
        restoring={props.restoring ?? false}
        error={props.error}
        deviceStatus={props.deviceStatus ?? 'pending'}
        onRestore={handlers.onRestore}
        onStartApproval={handlers.onStartApproval}
        onCheckApproval={handlers.onCheckApproval}
        onSignOut={handlers.onSignOut}
      />
    </ThemeProvider>
  );
}

async function renderScreen(props: Props = {}, preference: ThemePreference = 'light') {
  const checks = [...(props.checks ?? ['waiting'])];
  const handlers: Handlers = {
    onRestore: jest.fn(),
    onSignOut: jest.fn(),
    onStartApproval: jest.fn(async () => props.start ?? STARTED),
    onCheckApproval: jest.fn(async (_id: string) =>
      checks.length > 1 ? checks.shift()! : checks[0]!,
    ),
  };
  await render(build(props, preference, handlers));
  return {
    ...handlers,
    rerender: (next: Props) => screen.rerender(build(next, preference, handlers)),
  };
}

const openCode = async () => fireEvent.press(screen.getByTestId('vault.restore.codeOption'));
const submitWith = async (text: string) => {
  await fireEvent.changeText(screen.getByTestId('vault.restore.codeInput'), text);
  await fireEvent.press(screen.getByTestId('vault.restore.submit'));
};

describe.each(['light', 'dark'] as const)('in %s', (theme) => {
  it('shows the title, the text, the code option and the sign out link', async () => {
    await renderScreen({}, theme);
    expect(screen.getByRole('header', { name: t.title })).toBeOnTheScreen();
    expect(screen.getByText(t.message)).toBeOnTheScreen();
    expect(screen.getByText(t.codeOption)).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: t.signOut })).toBeOnTheScreen();
    expect(screen.getByText(t.approvalOption)).toBeOnTheScreen();
    // The input waits for the option. The last option arrives in the next branch.
    expect(screen.queryByTestId('vault.restore.codeInput')).toBeNull();
    expect(screen.queryByText('No tengo ninguno de los dos')).toBeNull();
  });

  it('opens the input with the code settings and sends what was typed', async () => {
    const { onRestore } = await renderScreen({}, theme);
    await openCode();
    const input = screen.getByTestId('vault.restore.codeInput');
    expect(input.props.autoCapitalize).toBe('characters');
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.accessibilityLabel).toBe(t.inputLabel);
    // Empty: nothing to send.
    await fireEvent.press(screen.getByTestId('vault.restore.submit'));
    expect(onRestore).not.toHaveBeenCalled();
    await submitWith('abcde fghjk');
    expect(onRestore).toHaveBeenCalledWith('abcde fghjk');
  });

  it.each(['invalid', 'wrongCode', 'tooMany', 'noBackup', 'removed', 'offline', 'failed'] as const)(
    'shows the %s error under the input',
    async (error) => {
      await renderScreen({ error }, theme);
      await openCode();
      await submitWith('x');
      expect(screen.getByTestId('vault.restore.error')).toHaveTextContent(t.errors[error]);
    },
  );

  it('clears the error when the code is edited', async () => {
    await renderScreen({ error: 'wrongCode' }, theme);
    await openCode();
    await submitWith('x');
    expect(screen.getByTestId('vault.restore.error')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('vault.restore.codeInput'), 'xy');
    expect(screen.queryByTestId('vault.restore.error')).toBeNull();
  });

  it('shows the spinner and no form while restoring', async () => {
    const { onSignOut } = await renderScreen({ restoring: true }, theme);
    expect(screen.getByText(t.restoring)).toBeOnTheScreen();
    expect(screen.getByLabelText(t.restoring)).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.restore.codeOption')).toBeNull();
    expect(screen.queryByTestId('vault.restore.submit')).toBeNull();
    await fireEvent.press(screen.getByTestId('vault.restore.signOut'));
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('signs out from the link', async () => {
    const { onSignOut } = await renderScreen({}, theme);
    await fireEvent.press(screen.getByRole('link', { name: t.signOut }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

it('uses a different background in dark than in light', async () => {
  await renderScreen({}, 'light');
  const light = String(screen.getByTestId('probe.background').props.children);
  await screen.unmount();
  await renderScreen({}, 'dark');
  expect(String(screen.getByTestId('probe.background').props.children)).not.toBe(light);
});

const A = t.approval;
const tick = (ms = 5000) => act(async () => jest.advanceTimersByTimeAsync(ms));
const startApproval = async () => {
  await fireEvent.press(screen.getByTestId('vault.restore.approvalOption'));
  await act(async () => undefined);
};

describe.each(['light', 'dark'] as const)('approval from the other phone, in %s', (theme) => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-30T10:00:00Z') });
  });
  afterEach(() => jest.useRealTimers());

  it('hides the option when the server already activated this phone', async () => {
    await renderScreen({ deviceStatus: 'active' }, theme);
    expect(screen.queryByTestId('vault.restore.approvalOption')).toBeNull();
    expect(screen.getByTestId('vault.restore.codeOption')).toBeOnTheScreen();
  });

  it('asks, then shows the instruction, the code in 3+3 and the waiting text', async () => {
    const h = await renderScreen({}, theme);
    await startApproval();
    expect(h.onStartApproval).toHaveBeenCalledTimes(1);
    expect(screen.getByText(A.instruction)).toBeOnTheScreen();
    expect(screen.getByTestId('vault.restore.approvalCode')).toHaveTextContent('048 291');
    expect(screen.getByText(A.waiting)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: A.cancel })).toBeOnTheScreen();
    // The options give way to the waiting view.
    expect(screen.queryByTestId('vault.restore.codeOption')).toBeNull();
  });

  it('looks every 5 seconds with the request id, and keeps waiting', async () => {
    const h = await renderScreen({}, theme);
    await startApproval();
    expect(h.onCheckApproval).not.toHaveBeenCalled();
    await tick(4900);
    expect(h.onCheckApproval).not.toHaveBeenCalled();
    await tick(100);
    expect(h.onCheckApproval).toHaveBeenCalledTimes(1);
    expect(h.onCheckApproval).toHaveBeenCalledWith('req-1');
    await tick();
    expect(h.onCheckApproval).toHaveBeenCalledTimes(2);
    expect(screen.getByText(A.waiting)).toBeOnTheScreen();
  });

  it('cancels back to the options and stops looking', async () => {
    const h = await renderScreen({}, theme);
    await startApproval();
    await fireEvent.press(screen.getByRole('button', { name: A.cancel }));
    expect(screen.getByTestId('vault.restore.codeOption')).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.restore.approvalCode')).toBeNull();
    await tick(20000);
    expect(h.onCheckApproval).not.toHaveBeenCalled();
  });

  it('stops looking when the screen goes away', async () => {
    const h = await renderScreen({}, theme);
    await startApproval();
    await screen.unmount();
    await tick(20000);
    expect(h.onCheckApproval).not.toHaveBeenCalled();
  });

  it('pauses while the restore runs', async () => {
    const h = await renderScreen({}, theme);
    await startApproval();
    await h.rerender({ restoring: true });
    expect(screen.getByText(t.restoring)).toBeOnTheScreen();
    await tick(20000);
    expect(h.onCheckApproval).not.toHaveBeenCalled();
  });

  it.each([
    ['rejected', A.messages.rejected, true],
    ['expired', A.messages.expired, true],
    ['grantLost', A.messages.grantLost, false],
    ['failed', A.messages.failed, false],
  ] as const)('shows %s and goes back to the options', async (check, text, canRetry) => {
    const h = await renderScreen({ checks: [check] }, theme);
    await startApproval();
    await tick();
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.restore.approvalCode')).toBeNull();
    expect(screen.getByTestId('vault.restore.codeOption')).toBeOnTheScreen();
    expect(!!screen.queryByTestId('vault.restore.approvalRetry')).toBe(canRetry);
    // It stopped looking.
    await tick(20000);
    expect(h.onCheckApproval).toHaveBeenCalledTimes(1);
  });

  it('asks again with "Pedir de nuevo" after a rejection', async () => {
    const h = await renderScreen({ checks: ['rejected'] }, theme);
    await startApproval();
    await tick();
    await fireEvent.press(screen.getByTestId('vault.restore.approvalRetry'));
    await act(async () => undefined);
    expect(h.onStartApproval).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('vault.restore.approvalCode')).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.restore.approvalMessage')).toBeNull();
  });

  it('keeps waiting, with a notice, while a poll is offline', async () => {
    await renderScreen({ checks: ['offline', 'waiting'] }, theme);
    await startApproval();
    await tick();
    expect(screen.getByTestId('vault.restore.approvalOffline')).toHaveTextContent(
      A.messages.offline,
    );
    expect(screen.getByTestId('vault.restore.approvalCode')).toBeOnTheScreen();
    await tick();
    expect(screen.queryByTestId('vault.restore.approvalOffline')).toBeNull();
  });

  it('stops at the expiry of the request even if the server still says waiting', async () => {
    const h = await renderScreen(
      { start: { ...STARTED, expiresAt: '2026-10-30T10:00:08Z' } },
      theme,
    );
    await startApproval();
    await tick();
    expect(screen.getByTestId('vault.restore.approvalCode')).toBeOnTheScreen();
    await tick();
    expect(screen.getByText(A.messages.expired)).toBeOnTheScreen();
    await tick(20000);
    expect(h.onCheckApproval).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ status: 'alreadyActive' }, A.messages.alreadyActive],
    [{ status: 'offline' }, A.messages.offline],
    [{ status: 'failed' }, A.messages.startFailed],
  ] as const)('shows why the request could not start (%j)', async (start, text) => {
    await renderScreen({ start }, theme);
    await startApproval();
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.restore.approvalRetry')).toBeNull();
    expect(screen.getByTestId('vault.restore.codeOption')).toBeOnTheScreen();
  });

  it('ignores a second press while the request is being made', async () => {
    const h = await renderScreen({}, theme);
    let answer!: (r: ApprovalStart) => void;
    h.onStartApproval.mockImplementationOnce(() => new Promise<ApprovalStart>((r) => (answer = r)));
    await fireEvent.press(screen.getByTestId('vault.restore.approvalOption'));
    expect(screen.getByTestId('vault.restore.starting')).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.restore.approvalOption')).toBeNull();
    await act(async () => answer(STARTED));
    expect(h.onStartApproval).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('vault.restore.approvalCode')).toBeOnTheScreen();
  });
});
