import { View } from 'react-native';

import { IconTile } from '../components/IconTile';
import type { StoryGroup } from './types';

export default {
  title: 'IconTile',
  stories: {
    TonesAndSizes: () => (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <IconTile icon="cart" />
        <IconTile icon="home" tone="soft" size={26} />
        <IconTile icon="security" tone="soft" size={36} />
        <IconTile icon="play" tone="accent" size={42} />
        <IconTile icon="tabRecommendations" tone="white" size={40} />
        <IconTile icon="warning" tone="danger" size={72} />
      </View>
    ),
  },
} satisfies StoryGroup;
