// Small pills of VerdeBilletera and VerdeRecomendaciones:
//   neutral  "Mensual", "Semanal", "Lun 29", "Simulado"
//   info     "Pagado"
//   accent   "Hoy", "En 2 días"
//   success  "Poco uso"
//   onPrimary "Mayor impacto" (on blue cards)
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../tokens';

export type BadgeTone = 'neutral' | 'info' | 'accent' | 'success' | 'onPrimary';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** sm: 9 px (recurring cards), md: 10 px (subscriptions, recommendations). */
  size?: 'sm' | 'md';
  testID?: string;
}

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.divider, fg: colors.textSecondary },
  info: { bg: colors.surfaceBlue, fg: colors.primaryDark },
  accent: { bg: colors.accent, fg: colors.white },
  success: { bg: colors.accentTint, fg: colors.link },
  onPrimary: { bg: colors.onPrimaryBadge, fg: colors.white },
};

export function Badge({ label, tone = 'neutral', size = 'md', testID }: BadgeProps) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.pill, size === 'sm' ? styles.sm : styles.md, { backgroundColor: t.bg }]}
      testID={testID}
    >
      <Text style={[styles.text, size === 'sm' ? styles.textSm : styles.textMd, { color: t.fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill },
  sm: { paddingVertical: 1, paddingHorizontal: 6 },
  md: { paddingVertical: 2, paddingHorizontal: 7 },
  text: { fontFamily: fonts.body.bold },
  textSm: { fontSize: 9, lineHeight: 12 },
  textMd: { fontSize: 10, lineHeight: 13 },
});
