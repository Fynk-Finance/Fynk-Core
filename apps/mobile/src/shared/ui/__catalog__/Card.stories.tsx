import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import type { StoryGroup } from './types';

export default {
  title: 'Card',
  stories: {
    Outlined: () => (
      <Card>
        <AppText variant="caption" color="textSecondary">
          Ganancia 2026
        </AppText>
      </Card>
    ),
    Soft: () => (
      <Card variant="soft">
        <AppText variant="smallStrong">Podrías ahorrar en 3 frentes</AppText>
      </Card>
    ),
    Primary: () => (
      <Card variant="primary" onPress={() => {}} accessibilityLabel="Oportunidad de ahorro">
        <AppText variant="cardTitle" color="onPrimary">
          Ahorra $56.800 al mes
        </AppText>
      </Card>
    ),
  },
} satisfies StoryGroup;
