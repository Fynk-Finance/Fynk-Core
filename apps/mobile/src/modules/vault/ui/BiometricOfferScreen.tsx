// One-time question after a password unlock: "¿Usar tu huella o Face ID?". New screen, needs
// design review: it is built from the lock screen's illustration and the shared buttons. The vault
// is already open behind it, and the same choice stays in Mi cuenta › Seguridad.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, GhostButton, PrimaryButton, Screen, spacing } from '@shared/ui';

import type { EnableBiometricsResult } from '../application/lockController';
import { LockIllustration } from './LockIllustration';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.biometric;

export interface BiometricOfferScreenProps {
  /** Writes copy B behind the system prompt. */
  onEnable: () => Promise<EnableBiometricsResult>;
  /** Goes on to the app. */
  onDone: () => void;
}

export function BiometricOfferScreen({ onEnable, onDone }: BiometricOfferScreenProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const enable = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const result = await onEnable();
      if (result === 'enabled') onDone();
      // Cancelled: the person stays here and can still say "Ahora no".
      if (result === 'failed') setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="vault.biometricOffer">
      <View style={styles.titles}>
        <AppText variant="title" accessibilityRole="header">
          {t.offer.title}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t.offer.subtitle}
        </AppText>
      </View>
      <View style={styles.art}>
        <LockIllustration />
      </View>
      <View style={styles.actions}>
        {failed ? (
          <AppText variant="caption" color="danger" accessibilityRole="alert">
            {t.failed}
          </AppText>
        ) : null}
        <PrimaryButton
          label={t.offer.enable}
          onPress={() => void enable()}
          loading={busy}
          testID="vault.biometricOffer.enable"
        />
        <GhostButton
          label={t.offer.later}
          onPress={onDone}
          disabled={busy}
          testID="vault.biometricOffer.later"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: { gap: spacing.xl },
  art: { flex: 1, minHeight: 0 },
  actions: { gap: spacing.xl },
});
