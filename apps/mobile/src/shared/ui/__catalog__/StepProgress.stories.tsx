import { View } from 'react-native';

import { StepProgress } from '../components/StepProgress';
import { colors } from '../tokens';
import type { StoryGroup } from './types';

const onBlue = { backgroundColor: colors.primary, padding: 20 };

export default {
  title: 'StepProgress',
  stories: {
    Step1: () => (
      <View style={onBlue}>
        <StepProgress step={1} onBack={() => {}} onSkip={() => {}} />
      </View>
    ),
    Step3: () => (
      <View style={onBlue}>
        <StepProgress step={3} onBack={() => {}} onSkip={() => {}} />
      </View>
    ),
  },
} satisfies StoryGroup;
