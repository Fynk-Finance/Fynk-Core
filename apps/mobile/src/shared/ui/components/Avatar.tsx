import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { fonts } from '../tokens';

export interface AvatarProps {
  name: string;
  /** 38 in headers, 84 in onboarding, 88 in Mi cuenta. */
  size?: number;
  /** `light` is the white circle used on the Inversión and Mi cuenta headers. */
  tone?: 'primary' | 'light';
}

// Initials sizes from the design code: 38 → 15, 84 → 30, 88 → 32.
const INITIALS_SIZE: Record<number, number> = { 38: 15, 84: 30, 88: 32 };

/** "Laura Gómez" → "LG". Uses at most two words. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters
    .map((w) => w?.charAt(0) ?? '')
    .join('')
    .toLocaleUpperCase('es-CO');
}

export function Avatar({ name, size = 38, tone = 'primary' }: AvatarProps) {
  const { colors } = useTheme();
  const light = tone === 'light';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          backgroundColor: light ? colors.onPrimary : colors.primaryLight,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize: INITIALS_SIZE[size] ?? Math.round(size * 0.38),
            color: light ? colors.primary : colors.onPrimary,
          },
        ]}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.heading.bold },
});
