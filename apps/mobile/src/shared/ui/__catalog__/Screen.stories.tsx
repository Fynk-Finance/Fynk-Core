import { AppText } from '../components/AppText';
import { HeaderBlue } from '../components/HeaderBlue';
import { Screen } from '../components/Screen';
import type { StoryGroup } from './types';

export default {
  title: 'Screen',
  stories: {
    Plain: () => (
      <Screen>
        <AppText variant="screenTitle">Notificaciones</AppText>
      </Screen>
    ),
    WithHeaderAndTabBar: () => (
      <Screen scroll withTabBar header={<HeaderBlue name="Laura Gómez" title="Billetera" />}>
        <AppText>Contenido</AppText>
      </Screen>
    ),
  },
} satisfies StoryGroup;
