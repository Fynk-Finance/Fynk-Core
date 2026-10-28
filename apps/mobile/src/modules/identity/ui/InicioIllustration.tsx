// Two bank cards and two coin stacks of the Inicio screen. Paths, viewBox and colors are
// copied from docs/design/source/VerdeInicio.dc.html (screen illustration colors stay in the
// module, see docs/design/README.md). The design's looping motion (fk-float, fk-shine, fk-drop,
// fk-twinkle) comes in a follow-up branch; this is its resting frame.
import Svg, { ClipPath, Defs, Ellipse, G, Path, Rect, Text } from 'react-native-svg';

import { fonts } from '@shared/ui';

import { identityStrings } from './strings.es-CO';

interface CardColors {
  base: string;
  shapeA: string;
  shapeB: string;
  chip: string;
  chipLines: string;
  nameBar: string;
  numberBar: string;
  logoA: string;
  logoB: string;
}

const LIME: CardColors = {
  base: '#a8e03a',
  shapeA: '#b5e654',
  shapeB: '#c3e877',
  chip: '#f4fbe3',
  chipLines: '#d2f09a',
  nameBar: '#d2f09a',
  numberBar: '#c3e877',
  logoA: '#dcf5a8',
  logoB: '#f8fdee',
};

const BLUE: CardColors = {
  base: '#50c1eb',
  shapeA: '#6bccef',
  shapeB: '#86d6f3',
  chip: '#e6f7fd',
  chipLines: '#a9e0f5',
  nameBar: '#a9e0f5',
  numberBar: '#86d6f3',
  logoA: '#b5e5f7',
  logoB: '#eef9fe',
};

function Card({ c }: { c: CardColors }) {
  return (
    <G clipPath="url(#fk-card-clip)">
      <Rect x={0} y={0} width={220} height={138} rx={18} fill={c.base} />
      <Rect x={132} y={-70} width={140} height={140} rx={30} fill={c.shapeA} />
      <Rect x={182} y={-30} width={80} height={80} rx={18} fill={c.shapeB} />
      <Rect x={22} y={40} width={36} height={27} rx={6} fill={c.chip} />
      <Path
        d="M22 53.5h36M40 40v27M31 40v6M49 40v6M31 61v6M49 61v6"
        stroke={c.chipLines}
        strokeWidth={1.5}
        fill="none"
      />
      <Path
        d="M70 46.5a10 10 0 0 1 0 14M76 42.5a16 16 0 0 1 0 22"
        stroke={c.chip}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={22} y={94} width={112} height={8} rx={4} fill={c.nameBar} />
      <Rect x={22} y={110} width={58} height={6} rx={3} fill={c.numberBar} />
      <Rect x={156} y={95} width={26} height={26} rx={6} fill={c.logoA} />
      <Rect x={174} y={95} width={26} height={26} rx={6} fill={c.logoB} fillOpacity={0.9} />
    </G>
  );
}

/** One coin: side, rim and face. (cx, cy) is the top face; `large` for the right stack. */
function Coin({ cx, cy, large }: { cx: number; cy: number; large: boolean }) {
  const rx = large ? 32 : 26;
  const ry = large ? 10 : 8;
  const h = large ? 9 : 8;
  return (
    <>
      <Ellipse cx={cx} cy={cy + h} rx={rx} ry={ry} fill="#8fc426" />
      <Rect x={cx - rx} y={cy} width={rx * 2} height={h} fill="#a8e03a" />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#f4fbe3" stroke="#a8e03a" strokeWidth={2} />
      <Ellipse
        cx={cx}
        cy={cy}
        rx={large ? 21.8 : 17.7}
        ry={large ? 6.8 : 5.4}
        fill="none"
        stroke="#d2f09a"
        strokeWidth={1.6}
      />
    </>
  );
}

function Dollar({ x, y }: { x: number; y: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(1 .42)`}>
      <Text
        x={0}
        y={7}
        textAnchor="middle"
        fontFamily={fonts.heading.bold}
        fontWeight="700"
        fontSize={22}
        fill="#6a9e12"
      >
        $
      </Text>
    </G>
  );
}

export function InicioIllustration() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="16 12 310 331"
      accessibilityRole="image"
      accessibilityLabel={identityStrings.inicio.illustration}
      testID="identity.inicio.illustration"
    >
      <Defs>
        <ClipPath id="fk-card-clip">
          <Rect x={0} y={0} width={220} height={138} rx={18} />
        </ClipPath>
      </Defs>
      <Rect x={21} y={28} width={300} height={300} rx={64} fill="#f4fbfe" />
      <Rect x={65} y={72} width={212} height={212} rx={44} fill="#e4f5fc" />
      <Ellipse cx={171} cy={300} rx={92} ry={9} fill="#d2eef9" />

      <G transform="translate(20 0)">
        <G transform="rotate(-20 50 80)">
          <G transform="translate(47 60)">
            <Card c={LIME} />
          </G>
        </G>
        <G transform="rotate(-8 171 176)">
          <G transform="translate(61 107)">
            <Card c={BLUE} />
          </G>
        </G>
      </G>

      <Ellipse cx={90} cy={302} rx={36} ry={7} fill="#e8f7cc" />
      <Coin cx={90} cy={292} large={false} />
      <Coin cx={92} cy={284} large={false} />
      <Coin cx={89} cy={276} large={false} />
      <Dollar x={89} y={276} />

      <Ellipse cx={258} cy={310} rx={42} ry={9} fill="#e8f7cc" />
      <Coin cx={258} cy={299} large />
      <Coin cx={261} cy={290} large />
      <Coin cx={256} cy={281} large />
      <Coin cx={260} cy={272} large />
      <Coin cx={257} cy={263} large />
      <Coin cx={259} cy={254} large />
      <Dollar x={259} y={254} />

      <Path d="M48 170l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#7fd3f2" />
      <Path d="M214 50l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#b9e862" />
      <Path d="M306 176l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2z" fill="#d2f09a" />
    </Svg>
  );
}
