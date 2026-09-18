/**
 * The "…" menu at the end of a row or the corner of a card.
 *
 * Three things, all real: open the item as a page, copy its link, delete it.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Maximize2, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { displayId } from '@/modules/projects/selectors';
import { useProjects } from '@/modules/projects/store';
import type { WorkItem } from '@/modules/projects/types';
import { Dropdown, DropdownItem, DropdownSeparator } from './Dropdown';

export const ItemMenu: React.FC<{ item: WorkItem; className?: string }> = ({
  item,
  className = '',
}) => {
  const { state, deleteWorkItem } = useProjects();
  const navigate = useNavigate();
  const id = displayId(state, item);
  const path = `/projects/${item.projectId}/items/${item.id}`;

  return (
    <Dropdown
      align="right"
      width="w-48"
      className={className}
      trigger={(open) => (
        <button
          type="button"
          aria-label={`More actions for ${id}`}
          className={`flex h-[22px] w-[22px] items-center justify-center rounded text-slate-400 transition-colors hover:bg-canvas hover:text-slate-700 ${
            open ? 'bg-canvas text-slate-700' : ''
          }`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      )}
    >
      {(close) => (
        <>
          <DropdownItem
            icon={<Maximize2 className="h-3.5 w-3.5 text-slate-500" />}
            onSelect={() => {
              close();
              navigate(path);
            }}
          >
            Open in full page
          </DropdownItem>
          <DropdownItem
            icon={<Link2 className="h-3.5 w-3.5 text-slate-500" />}
            onSelect={() => {
              close();
              const url = `${window.location.origin}${path}`;
              navigator.clipboard
                ?.writeText(url)
                .then(() => toast.success('Link copied', { description: url }))
                .catch(() => toast.error('Could not copy the link'));
            }}
          >
            Copy link
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem
            danger
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onSelect={() => {
              close();
              deleteWorkItem(item.id);
              toast.success(`${id} deleted`);
            }}
          >
            Delete
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
};
