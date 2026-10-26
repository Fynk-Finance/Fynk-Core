import { AppText, textVariants, type TextVariant } from '../components/AppText';
import type { StoryGroup } from './types';

export default {
  title: 'AppText',
  stories: {
    Variants: () => (
      <>
        {(Object.keys(textVariants) as TextVariant[]).map((v) => (
          <AppText key={v} variant={v}>
            {v} · Toma el control de tu dinero
          </AppText>
        ))}
      </>
    ),
    Secondary: () => (
      <AppText variant="small" color="textSecondary">
        Usa el correo con el que te registraste.
      </AppText>
    ),
  },
} satisfies StoryGroup;
