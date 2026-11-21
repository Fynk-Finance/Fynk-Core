import { SearchField } from '../components/SearchField';
import type { StoryGroup } from './types';

export default {
  title: 'SearchField',
  stories: {
    Empty: () => <SearchField placeholder="Buscar por nombre" />,
    WithText: () => <SearchField placeholder="Buscar por nombre" defaultValue="Café" />,
  },
} satisfies StoryGroup;
