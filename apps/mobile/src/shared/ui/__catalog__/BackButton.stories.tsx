import { BackButton } from '../components/BackButton';
import { OnColor } from './OnColor';
import type { StoryGroup } from './types';

export default {
  title: 'BackButton',
  stories: {
    OnPrimary: () => (
      <OnColor padding={12}>
        <BackButton onPress={() => {}} />
      </OnColor>
    ),
    Plain: () => <BackButton tone="plain" onPress={() => {}} />,
  },
} satisfies StoryGroup;
