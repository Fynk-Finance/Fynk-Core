// Small pills of VerdeBilletera and VerdeRecomendaciones:
//   neutral  "Mensual", "Semanal", "Lun 29", "Simulado"
//   info     "Pagado"
//   accent   "Hoy", "En 2 días"
//   success  "Poco uso"
//   onPrimary "Mayor impacto" (on blue cards)
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '../icons';
import { useTheme } from '../theme';
import { fonts, radius, type Palette } from '../tokens';

export type BadgeTone = 'neutral' | 'info' | 'accent' | 'success' | 'onPrimary';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** sm: 9 px (recurring cards), md: 10 px (subscriptions, recommendations), lg: 11 px (Mi cuenta). */
  size?: 'sm' | 'md' | 'lg';
  /** Drawn before the label at 12 px in the foreground color; sized for `lg` ("Perfil verificado"). */
  icon?: IconName;
  testID?: string;
}

function toneColors(colors: Palette, tone: BadgeTone): { bg: string; fg: string } {
  switch (tone) {
    case 'neutral':
      return { bg: colors.divider, fg: colors.textSecondary };
    case 'info':
      return { bg: colors.surfaceBlue, fg: colors.primaryDark };
    case 'accent':
      return { bg: colors.accent, fg: colors.onPrimary };
    case 'success':
      return { bg: colors.accentTint, fg: colors.link };
    case 'onPrimary':
      return { bg: colors.onPrimaryBadge, fg: colors.onPrimary };
  }
}

export function Badge({ label, tone = 'neutral', size = 'md', icon, testID }: BadgeProps) {
  const t = toneColors(useTheme().colors, tone);
  const pillStyle: StyleProp<ViewStyle>[] = [styles.pill, sizeStyles[size].pill];
  if (icon !== undefined) pillStyle.push(styles.withIcon);
  pillStyle.push({ backgroundColor: t.bg });
  return (
    <View style={pillStyle} testID={testID}>
      {icon === undefined ? null : <Icon name={icon} size={12} color={t.fg} strokeWidth={3.2} />}
      <Text style={[styles.text, sizeStyles[size].text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill },
  withIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sm: { paddingVertical: 1, paddingHorizontal: 6 },
  md: { paddingVertical: 2, paddingHorizontal: 7 },
  lg: { paddingVertical: 4, paddingHorizontal: 8 },
  text: { fontFamily: fonts.body.bold },
  textSm: { fontSize: 9, lineHeight: 12 },
  textMd: { fontSize: 10, lineHeight: 13 },
  textLg: { fontSize: 11, lineHeight: 14 },
});

const sizeStyles = {
  sm: { pill: styles.sm, text: styles.textSm },
  md: { pill: styles.md, text: styles.textMd },
  lg: { pill: styles.lg, text: styles.textLg },
};
