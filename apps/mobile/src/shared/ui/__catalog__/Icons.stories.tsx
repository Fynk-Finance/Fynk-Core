import { View } from 'react-native';

import { FynkLogo, Icon, icons, type IconName } from '../icons';
import { colors } from '../tokens';
import type { StoryGroup } from './types';

export default {
  title: 'Icons and logo',
  // Every path is already in icons/paths.ts; the snapshot keeps a sample.
  notSnapshotted: ['AllIcons'],
  stories: {
    Sample: () => (
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Icon name="bell" size={22} color={colors.primaryDark} />
        <Icon name="tabWalletActive" size={22} color={colors.primaryDark} />
        <Icon name="lock" size={18} color={colors.primaryDark} strokeWidth={2.4} />
        <Icon name="eye" size={20} accessibilityLabel="Ver" />
      </View>
    ),
    AllIcons: () => (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(Object.keys(icons) as IconName[]).map((name) => (
          <Icon key={name} name={name} size={22} color={colors.primaryDark} />
        ))}
      </View>
    ),
    Logo: () => (
      <View style={{ backgroundColor: colors.primary, padding: 16 }}>
        <FynkLogo />
      </View>
    ),
  },
} satisfies StoryGroup;
