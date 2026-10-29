// "Desbloqueo" card of CfgSeguridad: the Face ID or fingerprint switch. M1's Seguridad screen
// renders it with no props, under "Contraseña". The existence of copy B in the Keychain is the
// setting, so the switch reads it from the controller and keeps no flag of its own.
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  ListRow,
  Switch,
  fonts,
  radius,
  spacing,
  useThemedStyles,
} from '@shared/ui';

import type { LockController } from '../application/lockController';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.biometric;

export function createUnlockSetting(controller: LockController) {
  return function UnlockSetting() {
    const styles = useThemedStyles(createStyles);
    const [status, setStatus] = useState<{ supported: boolean; enabled: boolean } | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      let alive = true;
      void controller.biometricStatus().then((next) => alive && setStatus(next));
      return () => {
        alive = false;
      };
    }, []);

    const change = useCallback(async (next: boolean) => {
      setBusy(true);
      setFailed(false);
      try {
        if (!next) {
          await controller.disableBiometrics();
          setStatus({ supported: true, enabled: false });
          return;
        }
        const result = await controller.enableBiometrics();
        if (result === 'enabled') setStatus({ supported: true, enabled: true });
        if (result === 'failed') setFailed(true);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    }, []);

    // Nothing to offer on a phone without fingerprint or face.
    if (!status?.supported) return null;

    return (
      <View style={styles.section} testID="vault.unlockSetting">
        <AppText
          variant="caption"
          color="textSecondary"
          accessibilityRole="header"
          style={styles.label}
        >
          {t.card}
        </AppText>
        <Card style={styles.group}>
          <ListRow
            title={t.switchLabel}
            subtitle={t.switchHint}
            icon="fingerprint"
            iconTone="soft"
            iconSize={40}
            trailing={{
              kind: 'custom',
              node: (
                <Switch
                  value={status.enabled}
                  onValueChange={(next) => void change(next)}
                  accessibilityLabel={t.switchLabel}
                  disabled={busy}
                  testID="vault.unlockSetting.switch"
                />
              ),
            }}
          />
        </Card>
        {failed ? (
          <AppText
            variant="small"
            color="danger"
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            testID="vault.unlockSetting.error"
          >
            {t.failed}
          </AppText>
        ) : null}
      </View>
    );
  };
}

// Same look as the sections of Seguridad (CfgSeguridad.html): 12 px uppercase label, 20 px card.
const createStyles = () =>
  StyleSheet.create({
    section: { gap: spacing.md },
    label: { fontFamily: fonts.body.bold, letterSpacing: 0.72, textTransform: 'uppercase' },
    group: { borderRadius: radius.cardLg, paddingVertical: 6, paddingHorizontal: 16 },
  });
