// Every money value of the design: IBM Plex Mono, dot thousands, no decimals.
// Signed amounts: income in blue (#1F93C2) with "+", spending in ink with the typographic
// minus "−" the design draws. The accessibility label keeps the plain text.
import { Text, type TextStyle } from 'react-native';

import { formatCop, formatCopSigned } from '../../domain/money';
import type { MoneyMinor } from '../../domain/types';
import { useTheme } from '../theme';
import { fonts, lineHeight, type ColorToken, type FontSize } from '../tokens';

export interface AmountTextProps {
  amountMinor: MoneyMinor;
  signed?: boolean;
  size?: FontSize;
  weight?: 'medium' | 'semibold';
  /** Overrides the automatic color. `white` on blue headers and cards. */
  color?: ColorToken;
  style?: TextStyle;
  testID?: string;
}

const TYPOGRAPHIC_MINUS = '−';

export function AmountText({
  amountMinor,
  signed = false,
  size = 14,
  weight = 'semibold',
  color,
  style,
  testID,
}: AmountTextProps) {
  const { colors } = useTheme();
  const text = signed ? formatCopSigned(amountMinor) : formatCop(amountMinor);
  const display = text.replace(/^-/, TYPOGRAPHIC_MINUS);
  const auto: ColorToken = signed && amountMinor > 0 ? 'primaryDark' : 'textPrimary';
  return (
    <Text
      accessibilityLabel={text}
      testID={testID}
      numberOfLines={1}
      style={[
        {
          fontFamily: fonts.amount[weight],
          fontSize: size,
          lineHeight: lineHeight[size],
          // -0.02em on large amounts, as in the design
          letterSpacing: size >= 18 ? -0.02 * size : 0,
          color: colors[color ?? auto],
        },
        style,
      ]}
    >
      {display}
    </Text>
  );
}
