// Snapshot test of every story: a change to a component's output shows up in review.
import { act, render, screen } from '@testing-library/react-native';

import { storyGroups } from './index';

// The chart library renders hundreds of internal views. The snapshot keeps the props Fynk passes.
jest.mock('react-native-gifted-charts', () => ({
  LineChart: (props: object) => {
    const { createElement } = jest.requireActual<typeof import('react')>('react');
    return createElement('GiftedLineChart', props);
  },
}));

// Let effects scheduled with a zero delay (chart widths) run before the test ends.
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

const cases = storyGroups.flatMap((group) =>
  Object.entries(group.stories)
    .filter(([name]) => !group.notSnapshotted?.includes(name))
    .map(([name, Story]) => [`${group.title} / ${name}`, Story] as const),
);

describe('design system catalog', () => {
  it('has at least one story for every component', () => {
    expect(storyGroups.length).toBeGreaterThanOrEqual(19);
    for (const group of storyGroups) {
      expect(Object.keys(group.stories).length).toBeGreaterThan(0);
    }
  });

  it.each(cases)('%s matches its snapshot', async (_name, Story) => {
    await render(<Story />);
    const tree = screen.toJSON();
    expect(tree).not.toBeNull();
    expect(tree).toMatchSnapshot();
  });
});
