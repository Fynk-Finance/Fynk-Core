// Story helper: a box painted with a theme color, for components drawn on blue.
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';

export function OnColor({
  color = 'primary',
  padding,
  children,
}: {
  color?: ColorToken;
  padding?: number;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const style =
    padding === undefined
      ? { backgroundColor: colors[color] }
      : { backgroundColor: colors[color], padding };
  return <View style={style}>{children}</View>;
}
