import { LineChart } from '../components/LineChart';
import { OnColor } from './OnColor';
import type { StoryGroup } from './types';

// Heights of the "1A" line of Inversion (y grows downwards in the design).
const PORTFOLIO = [
  92, 105, 77, 106, 92, 76, 98, 82, 98, 68, 61, 67, 50, 74, 53, 55, 53, 56, 36, 29,
];

export default {
  title: 'LineChart',
  stories: {
    Portfolio: () => (
      <OnColor>
        <LineChart
          width={350}
          values={PORTFOLIO.map((y) => 120 - y)}
          accessibilityLabel="Evolución del portafolio"
        />
      </OnColor>
    ),
  },
} satisfies StoryGroup;
