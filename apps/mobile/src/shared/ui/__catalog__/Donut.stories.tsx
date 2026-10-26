import { AmountText } from '../components/AmountText';
import { AppText } from '../components/AppText';
import { Donut } from '../components/Donut';
import type { StoryGroup } from './types';

export default {
  title: 'Donut',
  stories: {
    Recomendaciones: () => (
      <Donut
        size={140}
        radius={54}
        segments={[
          { value: 5680000, color: 'primaryLight' },
          { value: 4500000, color: 'accent' },
          { value: 2500000, color: 'primaryDark' },
        ]}
        accessibilityLabel="Ahorro potencial de $126.800 al mes"
      >
        <AmountText amountMinor={12680000} size={18} />
        <AppText variant="caption" color="textSecondary">
          al mes
        </AppText>
      </Donut>
    ),
    Empty: () => <Donut segments={[]} size={104} radius={40} accessibilityLabel="Sin datos" />,
  },
} satisfies StoryGroup;
