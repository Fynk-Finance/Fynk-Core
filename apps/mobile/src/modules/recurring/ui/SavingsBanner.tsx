// "OPORTUNIDAD DE AHORRO · Ahorra $56.800 al mes · 2 suscripciones que casi no usas" (design
// Billetera, `.opp`): the blue card with squares and shine, a bulb tile and a chevron.
// It opens Recomendaciones (inventory row 9). Only shown when a subscription is marked low use.
import { StyleSheet, Text, View } from 'react-native';

import { formatCop } from '@shared/domain/money';
import type { MoneyMinor } from '@shared/domain/types';
import {
  AppText,
  Card,
  Icon,
  fonts,
  radius,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { recurringStrings } from './strings.es-CO';

const t = recurringStrings.billetera.savings;

export interface SavingsBannerProps {
  monthlyMinor: MoneyMinor;
  count: number;
  onPress: () => void;
}

export function SavingsBanner({ monthlyMinor, count, onPress }: SavingsBannerProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const amount = formatCop(monthlyMinor);
  return (
    <Card
      variant="primary"
      onPress={onPress}
      accessibilityLabel={t.label(amount)}
      testID="recurring.billetera.savings"
    >
      <View style={styles.row}>
        <View style={styles.tile}>
          <Icon name="tabRecommendations" size={24} color={colors.primaryDark} strokeWidth={2.2} />
        </View>
        <View style={styles.texts}>
          <AppText variant="overline" color="onPrimary" style={styles.soft}>
            {t.overline}
          </AppText>
          <AppText variant="cardTitle" color="onPrimary">
            {t.before}
            <Text style={styles.amount}>{amount}</Text>
            {t.after}
          </AppText>
          <AppText variant="caption" color="onPrimary" style={styles.soft}>
            {t.subtitle(count)}
          </AppText>
        </View>
        <View style={styles.chevron}>
          <Icon name="chevronRight" size={16} color={colors.primaryDark} strokeWidth={3.4} />
        </View>
      </View>
    </Card>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    texts: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 },
    soft: { opacity: 0.95 },
    amount: { fontFamily: fonts.amount.semibold },
    // White in light, the dark page color in dark (design Billetera, both themes).
    tile: {
      width: 40,
      height: 40,
      borderRadius: radius.tile,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevron: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
