// Recovery code (HU-045): shown once, then the person types the last group to prove they saved
// it. New screen, needs design review: it uses the card style of OnbListo.html and the input of
// OnbCorreo.html (the shared TextField). Used inside the vault flow (first phone) and by the
// pushed "Generar un código nuevo" screen. The code is only in props and state, never stored.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  BackButton,
  Card,
  GhostButton,
  Icon,
  IconTile,
  PrimaryButton,
  Screen,
  TextField,
  fonts,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { ConfirmResult } from '../application/recoveryCode';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.recovery;

export interface RecoveryCodeScreenProps {
  /** The 5 groups of the code, in order. */
  groups: string[];
  /** Compares the typed last group and uploads. `ok` ends the screen (the caller moves on). */
  onConfirm: (lastGroup: string) => Promise<ConfirmResult>;
  /** Puts text on the clipboard. */
  copyText: (text: string) => Promise<unknown>;
  /** Shows a close button before the code is confirmed (the pushed screen). */
  onClose?: () => void;
}

const COPIED_MS = 2000;

export function RecoveryCodeScreen({
  groups,
  onConfirm,
  copyText,
  onClose,
}: RecoveryCodeScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [step, setStep] = useState<'show' | 'confirm'>('show');
  const [copied, setCopied] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof t.errors | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await copyText(groups.join(' '));
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm(typed);
      if (result !== 'ok') setError(result);
    } catch {
      setError('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll gap={spacing.section} testID="vault.recovery">
      {onClose ? (
        <View style={styles.top}>
          <BackButton tone="plain" onPress={onClose} accessibilityLabel={t.close} />
        </View>
      ) : null}
      <View style={styles.titles}>
        <IconTile icon="security" tone="soft" size={72} />
        <AppText variant="title" accessibilityRole="header">
          {step === 'show' ? t.title : t.confirmTitle}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {step === 'show' ? t.subtitle : t.confirmSubtitle}
        </AppText>
      </View>

      {step === 'show' ? (
        <>
          <Card variant="soft" style={styles.card} testID="vault.recovery.card">
            <AppText variant="overline" color="textSecondary">
              {t.codeLabel}
            </AppText>
            <View style={styles.groups}>
              {groups.map((group, i) => (
                <AppText
                  key={i}
                  style={styles.group}
                  selectable
                  testID={`vault.recovery.group.${i}`}
                >
                  {group}
                </AppText>
              ))}
            </View>
            <GhostButton
              tone="neutral"
              icon={copied ? 'check' : undefined}
              label={copied ? t.copied : t.copy}
              onPress={() => void copy()}
              accessibilityHint={t.copyHint}
              testID="vault.recovery.copy"
            />
          </Card>

          <View style={styles.warning} accessibilityRole="alert">
            <Icon name="warning" size={20} color={colors.danger} />
            <AppText variant="small" style={styles.warningText}>
              {t.warning}
            </AppText>
          </View>

          <PrimaryButton
            label={t.saved}
            onPress={() => setStep('confirm')}
            testID="vault.recovery.saved"
          />
        </>
      ) : (
        <>
          <TextField
            label={t.inputLabel}
            placeholder={t.inputPlaceholder}
            value={typed}
            onChangeText={(text) => {
              setTyped(text);
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={() => void confirm()}
            error={error ? t.errors[error] : undefined}
            testID="vault.recovery.confirmInput"
          />
          <View style={styles.actions}>
            <PrimaryButton
              label={t.confirm}
              onPress={() => void confirm()}
              loading={busy}
              disabled={typed.trim() === ''}
              testID="vault.recovery.confirm"
            />
            <GhostButton
              label={t.seeCode}
              onPress={() => {
                setStep('show');
                setError(null);
              }}
              disabled={busy}
              testID="vault.recovery.seeCode"
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    top: { alignItems: 'flex-start' },
    titles: { gap: spacing.xl },
    card: { gap: spacing.section, padding: spacing.section, borderRadius: radius.cardLg },
    groups: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
    group: {
      fontFamily: fonts.amount.semibold,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: 1.5,
      color: colors.textPrimary,
    },
    warning: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xl,
      padding: spacing.xxl,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSurface,
    },
    warningText: { flex: 1 },
    actions: { gap: spacing.xl },
  });
