// Square icon tiles of the design. Sizes and radii come from the screens:
//   26/8 recurring cards, 32/10 info rows, 36/11 account options, 40/12 notifications,
//   42/13 subscriptions, 44/14 movements, 72/22 warning (VerdeOnbOmitir).
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '../icons';
import { colors } from '../tokens';

export type IconTileTone = 'outline' | 'soft' | 'accent' | 'danger' | 'white';
export type IconTileSize = 26 | 32 | 36 | 40 | 42 | 44 | 72;

export interface IconTileProps {
  icon: IconName;
  tone?: IconTileTone;
  size?: IconTileSize;
}

const RADIUS: Record<IconTileSize, number> = {
  26: 8,
  32: 10,
  36: 11,
  40: 12,
  42: 13,
  44: 14,
  72: 22,
};
const ICON: Record<IconTileSize, number> = {
  26: 14,
  32: 16,
  36: 18,
  40: 19,
  42: 20,
  44: 20,
  72: 34,
};

const TONES: Record<IconTileTone, { bg: string; fg: string; border?: string }> = {
  outline: { bg: colors.surfaceBlueSoft, fg: colors.primaryDark, border: colors.surfaceBlue },
  soft: { bg: colors.surfaceBlue, fg: colors.primaryDark },
  accent: { bg: colors.accent, fg: colors.white },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  white: { bg: colors.white, fg: colors.primaryDark },
};

export function IconTile({ icon, tone = 'outline', size = 44 }: IconTileProps) {
  const t = TONES[tone];
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: RADIUS[size],
          backgroundColor: t.bg,
          borderWidth: t.border ? 1 : 0,
          borderColor: t.border,
        },
      ]}
    >
      <Icon name={icon} size={ICON[size]} color={t.fg} strokeWidth={size === 72 ? 2.2 : 2} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
