import { SectionHeader } from '../components/SectionHeader';
import type { StoryGroup } from './types';

export default {
  title: 'SectionHeader',
  stories: {
    WithAction: () => (
      <SectionHeader title="Planes de ahorro" actionLabel="Ver todos" onAction={() => {}} />
    ),
    WithMeta: () => <SectionHeader title="Suscripciones" meta="4 activas · $112.600/mes" />,
  },
} satisfies StoryGroup;
