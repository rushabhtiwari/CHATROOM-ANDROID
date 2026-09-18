/**
 * `/projects/:id/items` — the main screen.
 *
 * All of the behaviour lives in `WorkItemsView`, which the cycle and module
 * screens render too. Keeping this file thin is what guarantees a cycle's board
 * behaves identically to the project's board, rather than being a near-copy
 * that drifts the moment one of them is changed.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { WorkItemsView } from '@/components/projects/WorkItemsView';

export const WorkItemsPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  return <WorkItemsView scope={{ projectId: id }} />;
};
