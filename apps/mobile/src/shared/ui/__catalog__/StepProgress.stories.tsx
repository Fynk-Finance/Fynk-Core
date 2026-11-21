import { StepProgress } from '../components/StepProgress';
import { OnColor } from './OnColor';
import type { StoryGroup } from './types';

export default {
  title: 'StepProgress',
  stories: {
    Step1: () => (
      <OnColor padding={20}>
        <StepProgress step={1} onBack={() => {}} onSkip={() => {}} />
      </OnColor>
    ),
    Step3: () => (
      <OnColor padding={20}>
        <StepProgress step={3} onBack={() => {}} onSkip={() => {}} />
      </OnColor>
    ),
  },
} satisfies StoryGroup;
