import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../tokens';
import { CURRENT, icons, type IconName, type IconShape } from './paths';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Icons are decorative unless a label is given. */
  accessibilityLabel?: string;
}

const resolve = (value: string | undefined, color: string) =>
  value === CURRENT ? color : (value ?? 'none');

function Shape({ shape, color }: { shape: IconShape; color: string }) {
  const stroke = 'stroke' in shape && shape.stroke === false ? 'none' : color;
  switch (shape.kind) {
    case 'path':
      return (
        <Path
          d={shape.d}
          fill={resolve(shape.fill, color)}
          stroke={stroke}
          opacity={shape.opacity}
        />
      );
    case 'rect':
      return (
        <Rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          fill={resolve(shape.fill, color)}
          stroke={stroke}
        />
      );
    case 'circle':
      return (
        <Circle
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={resolve(shape.fill, color)}
          stroke={stroke}
        />
      );
  }
}

export function Icon({
  name,
  size = 24,
  color = colors.textPrimary,
  strokeWidth = 2,
  accessibilityLabel,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={accessibilityLabel === undefined}
      importantForAccessibility={accessibilityLabel === undefined ? 'no-hide-descendants' : 'yes'}
    >
      {icons[name].map((shape, i) => (
        <Shape key={i} shape={shape} color={color} />
      ))}
    </Svg>
  );
}
