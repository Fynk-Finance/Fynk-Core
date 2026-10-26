// Every story group, in catalog order.
import AmountText from './AmountText.stories';
import AppText from './AppText.stories';
import BackButton from './BackButton.stories';
import Badge from './Badge.stories';
import Button from './Button.stories';
import Card from './Card.stories';
import Chip from './Chip.stories';
import Donut from './Donut.stories';
import HeaderBlue from './HeaderBlue.stories';
import Icons from './Icons.stories';
import IconTile from './IconTile.stories';
import LineChart from './LineChart.stories';
import ListRow from './ListRow.stories';
import ProgressBar from './ProgressBar.stories';
import Screen from './Screen.stories';
import SectionHeader from './SectionHeader.stories';
import States from './States.stories';
import StepProgress from './StepProgress.stories';
import TextField from './TextField.stories';
import type { StoryGroup } from './types';

export const storyGroups: StoryGroup[] = [
  AppText,
  Icons,
  Button,
  BackButton,
  TextField,
  Chip,
  Badge,
  AmountText,
  Card,
  IconTile,
  ListRow,
  SectionHeader,
  ProgressBar,
  StepProgress,
  HeaderBlue,
  Donut,
  LineChart,
  States,
  Screen,
];

export type { StoryGroup } from './types';
