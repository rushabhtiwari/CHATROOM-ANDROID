/**
 * `/projects/:id/items/:itemId` — a work item as a full page.
 *
 * The deep-link fallback for the peek panel: same body, no layout behind it.
 * This is what a link pasted into a conversation opens, where a peek would have
 * nothing to peek over.
 */

import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { displayId } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import { WorkItemDetail } from '@/components/projects/WorkItemDetail';

export const WorkItemPage: React.FC = () => {
  const { id = '', itemId = '' } = useParams<{ id: string; itemId: string }>();
  const { state } = useProjects();
  const item = state.workItems.byId[itemId];

  // A link to an item that has since been deleted lands back on the list rather
  // than on an empty page.
  if (!item || item.projectId !== id) {
    return <Navigate to={`/projects/${id}/items`} replace />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
        <Link
          to={`/projects/${id}/items`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-kiran"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All work items
        </Link>
        <span className="font-mono text-[11.5px] text-slate-300">·</span>
        <span className="font-mono text-[11.5px] text-muted">{displayId(state, item)}</span>
      </div>

      <div className="min-h-0 flex-1">
        <WorkItemDetail key={item.id} item={item} />
      </div>
    </div>
  );
};
