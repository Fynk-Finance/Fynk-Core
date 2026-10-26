import type { ReactElement } from 'react';

/** One component's examples. Every story is rendered by CatalogScreen and snapshot-tested. */
export interface StoryGroup {
  title: string;
  stories: Record<string, () => ReactElement>;
  /** Stories shown in the catalog but left out of the snapshot test (too large to review). */
  notSnapshotted?: string[];
}
