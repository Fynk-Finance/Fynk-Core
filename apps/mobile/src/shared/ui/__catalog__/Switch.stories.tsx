import { useState } from 'react';
import { View } from 'react-native';

import { Switch } from '../components/Switch';
import type { StoryGroup } from './types';

export default {
  title: 'Switch',
  stories: {
    OnAndOff: function OnAndOff() {
      const [on, setOn] = useState(true);
      const [off, setOff] = useState(false);
      return (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Switch value={on} onValueChange={setOn} accessibilityLabel="Recordatorio de pagos" />
          <Switch value={off} onValueChange={setOff} accessibilityLabel="Saldo bajo" />
        </View>
      );
    },
  },
} satisfies StoryGroup;
