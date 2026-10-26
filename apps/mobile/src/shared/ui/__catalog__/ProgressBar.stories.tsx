import { ProgressBar } from '../components/ProgressBar';
import type { StoryGroup } from './types';

export default {
  title: 'ProgressBar',
  stories: {
    Goal64: () => <ProgressBar progress={0.64} accessibilityLabel="Viaje a Cartagena, 64 %" />,
    Empty: () => <ProgressBar progress={0} />,
    Full: () => <ProgressBar progress={1.2} />,
  },
} satisfies StoryGroup;
