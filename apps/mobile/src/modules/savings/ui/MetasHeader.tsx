// Blue header of Metas (design Metas): the decorative squares, the lime sparkle and the moving
// shine, the back button, the "5 activas" pill, "Metas de ahorro" and its subtitle. The stats
// card overlaps its bottom 48 px. The design's back button is 48 px; the shared BackButton
// (44 px) is used, as on Conectar banco and Mi cuenta.
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import {
  AppText,
  BackButton,
  Shine,
  radius,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { savingsStrings } from './strings.es-CO';

const t = savingsStrings.metas;

export function MetasHeader({ activeCount, onBack }: { activeCount: number; onBack: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const top = insets.top;
  return (
    <View style={[styles.blue, { paddingTop: top + 16 }]} testID="savings.metas.header">
      <Svg width={390} height={208 + top} style={StyleSheet.absoluteFill}>
        <Rect x={252} y={-86} width={214} height={214} rx={50} fill={colors.headerShapeA} />
        <Rect x={314} y={-30} width={104} height={104} rx={26} fill={colors.headerShapeB} />
        <Rect x={-64} y={132 + top} width={150} height={150} rx={36} fill={colors.primaryPressed} />
        <Path
          d="M0 -11C.6 -4 4 -.6 11 0 4 .6 .6 4 0 11 -.6 4 -4 .6 -11 0 -4 -.6 -.6 -4 0 -11Z"
          transform={`translate(300 ${128 + top}) scale(.55)`}
          fill={colors.accentSoft}
        />
      </Svg>
      <Shine distance={620} height={300 + top} width={50} opacity={0.1} />
      <View style={styles.row}>
        <BackButton onPress={onBack} accessibilityLabel={t.back} />
        <View style={styles.pill}>
          <AppText variant="smallStrong" color="onPrimary">
            {t.active(activeCount)}
          </AppText>
        </View>
      </View>
      <AppText variant="title" color="onPrimary" accessibilityRole="header" style={styles.title}>
        {t.title}
      </AppText>
      <AppText variant="subtitle" color="onPrimary" style={styles.subtitle}>
        {t.subtitle}
      </AppText>
    </View>
  );
}

// Sizes from Metas.html: 16 px padding, 28 px bottom corners, title 28 px with -0.01em, subtitle
// at 92 % opacity, 208 px high with the bottom 48 px under the stats card.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    blue: {
      backgroundColor: colors.primary,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      paddingHorizontal: 16,
      paddingBottom: 72,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.onPrimaryOverlay,
    },
    title: { marginTop: 16, letterSpacing: -0.28 },
    subtitle: { marginTop: 4, opacity: 0.92 },
  });
