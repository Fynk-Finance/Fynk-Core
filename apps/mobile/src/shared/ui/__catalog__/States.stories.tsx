import { View } from 'react-native';

import { EmptyState, ErrorState, GhostCard, Skeleton } from '../components/States';
import { OnColor } from './OnColor';
import type { StoryGroup } from './types';

export default {
  title: 'EmptyState, ErrorState, Skeleton',
  stories: {
    Empty: () => (
      <EmptyState
        title="Aún no tienes metas"
        message="Crea una meta y te diremos cuánto ahorrar cada mes."
        actionLabel="Crear meta"
        onAction={() => {}}
      />
    ),
    Error: () => <ErrorState onRetry={() => {}} />,
    Skeleton: () => (
      <View style={{ gap: 8 }}>
        <Skeleton height={20} width="60%" />
        <Skeleton height={56} radius={14} />
      </View>
    ),
    GhostCard: () => (
      <GhostCard
        actionLabel="Crear meta"
        message="Aún no tienes metas"
        onAction={() => {}}
        style={{ width: 206, height: 112, borderRadius: 18 }}
      />
    ),
    GhostCardOnBlue: () => (
      <OnColor color="headerDashboard" padding={16}>
        <GhostCard actionLabel="Conectar cuenta" onAction={() => {}} onPrimary />
      </OnColor>
    ),
  },
} satisfies StoryGroup;
