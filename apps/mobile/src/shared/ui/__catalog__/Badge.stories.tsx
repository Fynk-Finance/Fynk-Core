import { View } from 'react-native';

import { Badge } from '../components/Badge';
import { colors } from '../tokens';
import type { StoryGroup } from './types';

export default {
  title: 'Badge',
  stories: {
    Tones: () => (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Badge label="Mensual" size="sm" />
        <Badge label="Pagado" tone="info" size="sm" />
        <Badge label="Hoy" tone="accent" size="sm" />
        <Badge label="En 2 días" tone="accent" size="sm" />
        <Badge label="Poco uso" tone="success" />
        <Badge label="Simulado" />
      </View>
    ),
    OnPrimary: () => (
      <View style={{ backgroundColor: colors.primaryLight, padding: 12 }}>
        <Badge label="Mayor impacto" tone="onPrimary" />
      </View>
    ),
  },
} satisfies StoryGroup;
