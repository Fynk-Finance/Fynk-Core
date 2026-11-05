// The red "Subió" chip next to a subscription with an open price alert (M9 prompt, SCRUM-61).
// The shared Badge has no danger tone, so this pill uses the same shape as Badge md with the
// theme's danger colors. New element, needs design review.
import { StyleSheet, Text, View } from 'react-native';

import { Icon, fonts, radius, useTheme } from '@shared/ui';

import { recurringStrings } from './strings.es-CO';

export function PriceUpChip() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.pill, { backgroundColor: colors.dangerSoft }]}
      testID="recurring.priceUp.chip"
    >
      <Icon name="arrowUpRight" size={12} color={colors.danger} strokeWidth={3.2} />
      <Text style={[styles.text, { color: colors.danger }]}>{recurringStrings.priceUp.chip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  text: { fontFamily: fonts.body.bold, fontSize: 10, lineHeight: 13 },
});
