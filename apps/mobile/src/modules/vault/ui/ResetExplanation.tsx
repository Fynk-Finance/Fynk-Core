// "No tengo ninguno de los dos" (HU-045): what is lost, what comes back, and how to confirm it is
// the owner. New screen, needs design review: it uses the title block of RestoreScreen and the
// primary and ghost buttons. The server decides whether the reset is allowed.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  GhostButton,
  PrimaryButton,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { ResetResult } from '../application/resetBackup';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.restore.reset;

export interface ResetExplanationProps {
  onReset: () => Promise<ResetResult>;
  /** Ends the session so the person can use "¿Olvidaste tu contraseña?" on Keycloak's page. */
  onResetPassword: () => void;
  onBack: () => void;
}

export function ResetExplanation({ onReset, onResetPassword, onBack }: ResetExplanationProps) {
  const styles = useThemedStyles(createStyles);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Exclude<ResetResult, 'ok'> | null>(null);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    let result: ResetResult;
    try {
      result = await onReset();
    } catch {
      result = 'failed';
    }
    // On ok the phone sets itself up and this view goes away.
    setBusy(false);
    if (result !== 'ok') setOutcome(result);
  };

  return (
    <View style={styles.wrap} testID="vault.restore.reset">
      <AppText variant="body">{t.lost}</AppText>
      <AppText variant="body" color="textSecondary">
        {t.reload}
      </AppText>
      <AppText variant="body" color="textSecondary">
        {t.confirm}
      </AppText>

      {outcome ? (
        <View style={styles.notice} testID="vault.restore.resetMessage">
          <AppText
            variant="smallStrong"
            color="danger"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {t.messages[outcome]}
          </AppText>
        </View>
      ) : null}

      {outcome === 'notAllowed' ? (
        <PrimaryButton
          label={t.resetPassword}
          onPress={onResetPassword}
          testID="vault.restore.resetPassword"
        />
      ) : (
        <PrimaryButton
          label={t.start}
          onPress={() => void start()}
          disabled={busy}
          loading={busy}
          testID="vault.restore.resetStart"
        />
      )}
      <GhostButton
        label={t.back}
        onPress={onBack}
        disabled={busy}
        testID="vault.restore.resetBack"
      />
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    wrap: { gap: spacing.xl },
    notice: {
      padding: spacing.xl,
      borderRadius: 14,
      backgroundColor: colors.dangerSurface,
    },
  });
