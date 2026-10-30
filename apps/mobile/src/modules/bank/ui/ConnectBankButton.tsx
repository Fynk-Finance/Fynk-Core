// "Agregar otra cuenta" from OnbCuentas.html: the dashed button that opens Conectar banco.
// M3 (onboarding step 3) and M6 (Billetera) place it; M5 owns where it goes.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Pressable, StyleSheet } from 'react-native';

import { AppText, Icon, fonts, useTheme, useThemedStyles, type Theme } from '@shared/ui';

import { bankStrings } from './strings.es-CO';

export const CONNECT_BANK_ROUTE = 'bank.Connect' as const;

export function ConnectBankButton({ label = bankStrings.list.addAccount }: { label?: string }) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => navigation.navigate(CONNECT_BANK_ROUTE)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
      testID="bank.connectButton"
    >
      <Icon name="plus" size={16} color={colors.primaryDeep} strokeWidth={2.6} />
      <AppText variant="bodyStrong" color="primaryDeep" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

// OnbCuentas.html: height 48, radius 16, 1.5 px dashed primary border, soft blue background,
// 15 px bold text in the deep blue, a 16 px plus icon, gap 8.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    button: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.surfaceBlueSoft,
    },
    pressed: { backgroundColor: colors.surfaceBlue },
    label: { fontFamily: fonts.body.bold },
  });
