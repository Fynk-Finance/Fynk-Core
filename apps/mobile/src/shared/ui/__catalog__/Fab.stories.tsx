import { View } from 'react-native';

import { Fab } from '../components/Fab';
import type { StoryGroup } from './types';

export default {
  title: 'Fab',
  stories: {
    Round: () => <Fab onPress={() => {}} accessibilityLabel="Registrar gasto o ingreso" />,
    Open: () => <Fab onPress={() => {}} accessibilityLabel="Registrar gasto o ingreso" expanded />,
    Extended: () => (
      <View style={{ alignItems: 'flex-start' }}>
        <Fab
          onPress={() => {}}
          accessibilityLabel="Crear nueva meta de ahorro"
          label="Nueva meta"
        />
      </View>
    ),
  },
} satisfies StoryGroup;
