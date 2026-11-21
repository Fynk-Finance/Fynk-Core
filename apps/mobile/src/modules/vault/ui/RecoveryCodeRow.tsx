// "Código de recuperación" section of Seguridad: M1's screen renders it with no props under
// "Desbloqueo". Same section and card style as UnlockSetting. New row, needs design review.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, ListRow, fonts, radius, spacing, useThemedStyles } from '@shared/ui';

import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.recovery.row;

/** The pushed screen that makes a new recovery code (index.ts registers it under this name). */
export const RECOVERY_CODE_ROUTE = 'vault.RecoveryCode' as const;

export function RecoveryCodeRow() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section} testID="vault.recoveryRow">
      <AppText
        variant="caption"
        color="textSecondary"
        accessibilityRole="header"
        style={styles.label}
      >
        {t.section}
      </AppText>
      <Card style={styles.group}>
        <ListRow
          title={t.title}
          subtitle={t.hint}
          icon="lock"
          iconTone="soft"
          iconSize={40}
          trailing={{ kind: 'chevron' }}
          onPress={() => navigation.navigate(RECOVERY_CODE_ROUTE)}
          accessibilityLabel={`${t.title}. ${t.hint}`}
          testID="vault.recoveryRow.new"
        />
      </Card>
    </View>
  );
}

// Same look as the sections of Seguridad (CfgSeguridad.html): 12 px uppercase label, 20 px card.
const createStyles = () =>
  StyleSheet.create({
    section: { gap: spacing.md },
    label: { fontFamily: fonts.body.bold, letterSpacing: 0.72, textTransform: 'uppercase' },
    group: { borderRadius: radius.cardLg, paddingVertical: 6, paddingHorizontal: 16 },
  });
