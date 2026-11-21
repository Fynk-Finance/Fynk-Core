// Segment colors of the donut, in the order of the Recomendaciones design (#1f93c2, #a8e03a,
// #50c1eb), then more tokens of the same family for longer lists. Only palette tokens, so the
// donut follows light and dark.
import type { ColorToken } from '@shared/ui';

export const SEGMENT_COLORS: readonly ColorToken[] = [
  'primaryDark',
  'accent',
  'primaryLight',
  'primaryDeep',
  'accentStroke',
  'borderBlueStrong',
  'accentSoft',
  'textPlaceholder',
];

export function segmentColor(index: number): ColorToken {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? 'primary';
}
