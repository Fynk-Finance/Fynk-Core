import { View } from 'react-native';

import { Chip } from '../components/Chip';
import type { StoryGroup } from './types';

export default {
  title: 'Chip',
  stories: {
    Filters: () => (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Todas" selected />
        <Chip label="Gastos" />
        <Chip label="Ahorro" />
      </View>
    ),
  },
} satisfies StoryGroup;
