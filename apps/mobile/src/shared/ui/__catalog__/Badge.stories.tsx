import { View } from 'react-native';

import { Badge } from '../components/Badge';
import { OnColor } from './OnColor';
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
    WithIcon: () => <Badge label="Perfil verificado" tone="accent" size="lg" icon="check" />,
    OnPrimary: () => (
      <OnColor color="primaryLight" padding={12}>
        <Badge label="Mayor impacto" tone="onPrimary" />
      </OnColor>
    ),
  },
} satisfies StoryGroup;
