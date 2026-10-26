import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts, type ColorToken } from '../tokens';

// Text styles found in the design code. Modules pick a variant instead of setting fonts.
export const textVariants = {
  display: { fontFamily: fonts.heading.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.68 },
  title: { fontFamily: fonts.heading.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.28 },
  screenTitle: { fontFamily: fonts.heading.bold, fontSize: 26, lineHeight: 32 },
  section: { fontFamily: fonts.heading.bold, fontSize: 20, lineHeight: 26 },
  headerTitle: { fontFamily: fonts.heading.bold, fontSize: 17, lineHeight: 22 },
  cardTitle: { fontFamily: fonts.heading.bold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fonts.body.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.body.semibold, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: fonts.body.semibold, fontSize: 14, lineHeight: 20 },
  subtitle: { fontFamily: fonts.body.medium, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fonts.body.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.body.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body.regular, fontSize: 12, lineHeight: 16 },
  captionStrong: { fontFamily: fonts.body.semibold, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: fonts.body.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: ColorToken;
  align?: TextStyle['textAlign'];
}

export function AppText({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        textVariants[variant],
        { color: colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
