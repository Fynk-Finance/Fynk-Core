// The Fynk logo, copied from VerdeLogin.dc.html (mark 34 x 42 plus the "Fynk" wordmark).
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';

import { colors, fonts } from '../tokens';

export interface FynkLogoProps {
  /** Height of the mark. The design uses 42. */
  height?: number;
  color?: string;
  withWordmark?: boolean;
}

const MARK_RATIO = 34 / 42;

export function FynkLogo({
  height = 42,
  color = colors.white,
  withWordmark = true,
}: FynkLogoProps) {
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="Fynk">
      <Svg width={height * MARK_RATIO} height={height} viewBox="80 20 510 640">
        <G transform="matrix(1 -0.16 0 1 0 0)" fill={color}>
          <Path d="M130,126 H540 Q570,126 570,156 V230 Q570,252 548,252 H262 Q240,252 240,274 V383 Q240,405 262,405 H548 Q570,405 570,427 V531 Q570,561 540,561 H130 Q100,561 100,531 V156 Q100,126 130,126 Z" />
          <Rect x={262} y={268} width={120} height={120} rx={38} />
          <Path d="M152,588 H345 V680 Q345,696 330,689 Z" />
        </G>
      </Svg>
      {withWordmark ? <Text style={[styles.wordmark, { color }]}>Fynk</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: {
    fontFamily: fonts.heading.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.26,
  },
});
