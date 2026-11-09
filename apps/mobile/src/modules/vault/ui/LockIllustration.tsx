// Padlock in front of a blue bank card, drawn with the shapes and exact colors of the Inicio
// illustration (see identity/ui/InicioIllustration.tsx). The design has no lock screen, so this
// picture is new and needs design review. Screen illustration colors stay in the module (see
// docs/design/README.md). Static: nothing moves.
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { useTheme, type ColorScheme } from '@shared/ui';

import { vaultStrings } from './strings.es-CO';

// Backdrop and ground shadow are the only colors that change with the theme (Inicio's ILLUSTRATION).
const SCENE: Record<ColorScheme, { outer: string; inner: string; shadow: string }> = {
  light: { outer: '#f4fbfe', inner: '#e4f5fc', shadow: '#d2eef9' },
  dark: { outer: '#182a37', inner: '#1a3444', shadow: '#1d3a4a' },
};

const VIEW_BOX = '0 0 342 320';

// Sparkle paths and fills of Inicio's SPARKS, each placed around the padlock.
const SPARKS = [
  { d: 'M48 170l3 7 7 3-7 3-3 7-3-7-7-3 7-3z', fill: '#7fd3f2', at: [2, -84] },
  {
    d: 'M214 50l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z',
    fill: '#b9e862',
    at: [78, 6],
  },
  { d: 'M306 176l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2z', fill: '#d2f09a', at: [-30, 67] },
] as const;

export function LockIllustration() {
  const { scheme } = useTheme();
  const c = SCENE[scheme];
  return (
    <View
      style={styles.fill}
      accessible
      accessibilityRole="image"
      accessibilityLabel={vaultStrings.lock.illustration}
      testID="vault.lock.illustration"
    >
      <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
        <Defs>
          <ClipPath id="fk-lock-card-clip">
            <Rect x={0} y={0} width={220} height={138} rx={18} />
          </ClipPath>
          <ClipPath id="fk-lock-body-clip">
            <Rect x={106} y={150} width={130} height={104} rx={26} />
          </ClipPath>
        </Defs>

        <Rect x={21} y={10} width={300} height={300} rx={64} fill={c.outer} />
        <Rect x={65} y={54} width={212} height={212} rx={44} fill={c.inner} />
        <Ellipse cx={171} cy={270} rx={92} ry={9} fill={c.shadow} />

        {/* Blue card behind, tilted, same shapes as Inicio's Card. */}
        <G transform="translate(61 62) rotate(-10 110 69)">
          <G clipPath="url(#fk-lock-card-clip)">
            <Rect x={0} y={0} width={220} height={138} rx={18} fill="#50c1eb" />
            <Rect x={132} y={-70} width={140} height={140} rx={30} fill="#6bccef" />
            <Rect x={182} y={-30} width={80} height={80} rx={18} fill="#86d6f3" />
            <Rect x={22} y={40} width={36} height={27} rx={6} fill="#e6f7fd" />
            <Rect x={22} y={94} width={112} height={8} rx={4} fill="#a9e0f5" />
          </G>
        </G>

        {/* Padlock: shackle first so the body covers its feet. */}
        <Path
          d="M138 158V132a33 33 0 0 1 66 0v26"
          stroke="#2fa8d8"
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
        />
        <Rect x={106} y={150} width={130} height={104} rx={26} fill="#a8e03a" />
        <G clipPath="url(#fk-lock-body-clip)">
          <Rect x={176} y={110} width={90} height={90} rx={22} fill="#b5e654" />
        </G>
        <Circle cx={171} cy={192} r={12} fill="#f4fbe3" />
        <Rect x={166} y={196} width={10} height={28} rx={5} fill="#f4fbe3" />

        {SPARKS.map((s) => (
          <G key={s.d} transform={`translate(${s.at[0]} ${s.at[1]})`}>
            <Path d={s.d} fill={s.fill} />
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stretch: a flex child inside a centered parent would otherwise collapse to zero width.
  fill: { flex: 1, alignSelf: 'stretch', minHeight: 0 },
});
