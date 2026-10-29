// Blue header of Conectar banco (ConectarBanco.html): the decorative squares and the moving shine,
// the back button, "Conecta tu banco" and its subtitle. The design's back button is 48 px; the
// shared BackButton (44 px) is used, as on Mi cuenta.
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import {
  AppText,
  BackButton,
  Shine,
  radius,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { bankStrings } from './strings.es-CO';

const t = bankStrings.connect;

export function ConnectBankHeader({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.blue, { paddingTop: insets.top + 16 }]} testID="bank.connect.header">
      <Svg width={390} height={176 + insets.top} style={StyleSheet.absoluteFill}>
        <Rect x={250} y={-80} width={210} height={210} rx={48} fill={colors.headerShapeA} />
        <Rect x={312} y={-28} width={104} height={104} rx={26} fill={colors.headerShapeB} />
        <Rect
          x={-60}
          y={96 + insets.top}
          width={140}
          height={140}
          rx={34}
          fill={colors.primaryPressed}
        />
      </Svg>
      <Shine distance={620} height={260 + insets.top} width={50} opacity={0.12} />
      <BackButton onPress={onBack} />
      <AppText
        variant="screenTitle"
        color="onPrimary"
        accessibilityRole="header"
        style={styles.title}
      >
        {t.title}
      </AppText>
      <AppText variant="subtitle" color="onPrimary" style={styles.subtitle}>
        {t.subtitle}
      </AppText>
    </View>
  );
}

// Sizes from ConectarBanco.html: 16 px padding, 24 px bottom corners, title 16 px below the
// button with -0.01em spacing, subtitle at 92 % opacity, 176 px high in all.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    blue: {
      backgroundColor: colors.primary,
      borderBottomLeftRadius: radius.sheetSm,
      borderBottomRightRadius: radius.sheetSm,
      paddingHorizontal: 16,
      paddingBottom: 40,
      overflow: 'hidden',
    },
    title: { marginTop: 16, letterSpacing: -0.26 },
    subtitle: { marginTop: 4, opacity: 0.92 },
  });
