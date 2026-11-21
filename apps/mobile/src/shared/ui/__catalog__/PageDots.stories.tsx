import { useState } from 'react';

import { PageDots } from '../components/PageDots';
import { OnColor } from './OnColor';
import type { StoryGroup } from './types';

export default {
  title: 'PageDots',
  stories: {
    FourAccounts: function FourAccounts() {
      const [index, setIndex] = useState(0);
      return (
        <OnColor padding={16}>
          <PageDots
            labels={[
              'Ver Banco Demo',
              'Ver Billetera Demo',
              'Ver Banco Demo Crédito',
              'Ver Efectivo',
            ]}
            index={index}
            onSelect={setIndex}
          />
        </OnColor>
      );
    },
  },
} satisfies StoryGroup;
