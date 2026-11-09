import { useState } from 'react';

import type { CategoryId } from '../../domain/types';
import { Dropdown } from '../components/Dropdown';
import { categoryOptions } from '../icons/categoryIcons';
import type { StoryGroup } from './types';

export default {
  title: 'Dropdown',
  stories: {
    Category: function Category() {
      const [value, setValue] = useState<CategoryId | null>('groceries');
      return (
        <Dropdown
          label="Categoría"
          options={categoryOptions()}
          value={value}
          onChange={setValue}
          noneLabel="Sin categoría"
          onClear={() => setValue(null)}
        />
      );
    },
  },
} satisfies StoryGroup;
