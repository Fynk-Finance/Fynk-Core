// Grayscale illustration above "Aún no tienes movimientos." on the Dashboard (QA review
// 2026-11-07, V10): a movement card with two empty rows over a card behind it, and a round
// badge with the up and down arrows of income and spending. Drawn only with the theme's neutral
// colors, so it follows light and dark. Decorative: screen readers skip it. New illustration,
// needs design review.
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@shared/ui';

export function EmptyMovementsIllustration({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width={160} height={128} viewBox="0 0 160 128">
        {/* The card behind, tilted. */}
        <Rect
          x={40}
          y={14}
          width={100}
          height={78}
          rx={14}
          fill={colors.divider}
          transform="rotate(8 90 53)"
        />
        {/* The movement card with two empty rows. */}
        <Rect
          x={22}
          y={28}
          width={104}
          height={84}
          rx={16}
          fill={colors.background}
          stroke={colors.border}
          strokeWidth={2}
        />
        <Circle cx={44} cy={54} r={10} fill={colors.divider} />
        <Rect x={62} y={47} width={46} height={6} rx={3} fill={colors.trackOff} />
        <Rect x={62} y={58} width={30} height={6} rx={3} fill={colors.divider} />
        <Circle cx={44} cy={88} r={10} fill={colors.divider} />
        <Rect x={62} y={81} width={40} height={6} rx={3} fill={colors.trackOff} />
        <Rect x={62} y={92} width={24} height={6} rx={3} fill={colors.divider} />
        {/* Income and spending arrows. */}
        <Circle
          cx={124}
          cy={30}
          r={18}
          fill={colors.controlBorder}
          stroke={colors.background}
          strokeWidth={4}
        />
        <Path
          d="M118 36V24m0 0-4 4m4-4 4 4M130 24v12m0 0-4-4m4 4 4-4"
          stroke={colors.background}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
