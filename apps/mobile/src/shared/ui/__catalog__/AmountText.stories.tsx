import { AmountText } from '../components/AmountText';
import type { StoryGroup } from './types';

export default {
  title: 'AmountText',
  stories: {
    Balance: () => <AmountText amountMinor={1248035000} size={34} />,
    Income: () => <AmountText amountMinor={520000000} signed />,
    Spending: () => <AmountText amountMinor={-18430000} signed />,
    OnBlue: () => <AmountText amountMinor={193060000} size={24} color="onPrimary" />,
  },
} satisfies StoryGroup;
