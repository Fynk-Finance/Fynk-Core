import { useState } from 'react';

import { SegmentedControl } from '../components/SegmentedControl';
import { OnColor } from './OnColor';
import type { StoryGroup } from './types';

const PERIODS = [
  { value: '3d', label: '3 días' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
] as const;

export default {
  title: 'SegmentedControl',
  stories: {
    Period: function Period() {
      const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('3d');
      return (
        <OnColor padding={16}>
          <SegmentedControl
            options={[...PERIODS]}
            value={period}
            onChange={setPeriod}
            accessibilityLabel="Periodo de la gráfica"
          />
        </OnColor>
      );
    },
  },
} satisfies StoryGroup;
