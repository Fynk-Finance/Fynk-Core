// "Generar un código nuevo": pushed from Seguridad. It asks for a fresh login first (on mount, so
// a deep link cannot skip it), makes a new code from the DEK in copy A and shows it. Nothing is
// uploaded, and the old code keeps working, until the person confirms the new one.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { AppText, Screen, useTheme } from '@shared/ui';

import type { LockController } from '../application/lockController';
import { confirmRecoveryCode, type PreparedRecoveryCode } from '../application/recoveryCode';
import { RecoveryCodeScreen } from './RecoveryCodeScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.recovery.newCode;

export interface NewRecoveryCodeDeps {
  controller: Pick<LockController, 'prepareNewRecoveryCode'>;
  copyText: (text: string) => Promise<unknown>;
}

export function createNewRecoveryCodeScreen({ controller, copyText }: NewRecoveryCodeDeps) {
  return function NewRecoveryCodeScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const { colors } = useTheme();
    const [prepared, setPrepared] = useState<PreparedRecoveryCode | null>(null);

    useEffect(() => {
      let alive = true;
      void controller.prepareNewRecoveryCode().then((result) => {
        if (!alive) return;
        if (result.status === 'ready') {
          setPrepared(result.prepared);
          return;
        }
        // Cancelling the password step is the person's choice; a failure is told once.
        if (result.status === 'failed') Alert.alert(t.failedTitle, t.failedMessage);
        navigation.goBack();
      });
      return () => {
        alive = false;
      };
      // Runs once per visit: a second run would ask for the password again.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!prepared) {
      return (
        <Screen testID="vault.recovery.preparing">
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} accessibilityLabel={t.preparing} />
            <AppText variant="small" color="textSecondary" align="center">
              {t.preparing}
            </AppText>
          </View>
        </Screen>
      );
    }
    return (
      <RecoveryCodeScreen
        groups={prepared.groups}
        copyText={copyText}
        onClose={() => navigation.goBack()}
        onConfirm={async (lastGroup) => {
          const result = await confirmRecoveryCode(prepared, lastGroup);
          if (result === 'ok') navigation.goBack();
          return result;
        }}
      />
    );
  };
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
