import { View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { colors } from '../tokens';
import type { StoryGroup } from './types';

export default {
  title: 'BackButton',
  stories: {
    OnPrimary: () => (
      <View style={{ backgroundColor: colors.primary, padding: 12 }}>
        <BackButton onPress={() => {}} />
      </View>
    ),
    Plain: () => <BackButton tone="plain" onPress={() => {}} />,
  },
} satisfies StoryGroup;
