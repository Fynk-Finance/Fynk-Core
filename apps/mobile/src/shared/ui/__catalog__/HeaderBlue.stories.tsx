import { AmountText } from '../components/AmountText';
import { HeaderBlue } from '../components/HeaderBlue';
import type { StoryGroup } from './types';

const noop = () => {};

export default {
  title: 'HeaderBlue',
  stories: {
    Greeting: () => (
      <HeaderBlue name="Laura Gómez" hasUnread onPressAccount={noop} onPressNotifications={noop} />
    ),
    BilleteraTitle: () => (
      <HeaderBlue
        name="Laura Gómez"
        hasUnread
        title="Billetera"
        subtitle="Gastos fijos de este mes"
        trailing={<AmountText amountMinor={193060000} size={24} color="white" />}
      />
    ),
    NoUnreadDecorated: () => <HeaderBlue name="Laura" decorated avatarTone="light" />,
  },
} satisfies StoryGroup;
