/**
 * The comment thread and the activity feed.
 *
 * Split out of the detail panel because between them they are most of its
 * length, and neither needs anything from it beyond the item id.
 */

import React, { useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { MessageSquare, History, Timer, Trash2 } from 'lucide-react';
import { activityFor, commentsFor, timeEntriesFor } from '@/modules/projects/selectors';
import { BLENDED_HOURLY_RATE_INR } from '@/modules/projects/constants';
import { formatINR } from '@/utils/formatters';
import { personById } from '@/modules/projects/people';
import { useProjects } from '@/modules/projects/store';
import type { Activity } from '@/modules/projects/types';
import { Avatar } from './Glyphs';
import { Markdown } from './Markdown';

const ago = (iso: string) => formatDistanceToNow(parseISO(iso), { addSuffix: true });

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export const CommentThread: React.FC<{ workItemId: string }> = ({ workItemId }) => {
  const { state, addComment, currentUserId } = useProjects();
  const [draft, setDraft] = useState('');

  const comments = commentsFor(state, workItemId);
  const me = personById(currentUserId);

  const submit = () => {
    if (!draft.trim()) return;
    addComment(workItemId, draft);
    setDraft('');
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
        <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
        Comments
        {comments.length > 0 && (
          <span className="font-mono text-[12px] text-muted">{comments.length}</span>
        )}
      </h3>

      <div className="space-y-3">
        {comments.map((comment) => {
          const author = personById(comment.authorId);
          return (
            <div key={comment.id} className="flex gap-2.5">
              {author ? (
                <Avatar
                  name={author.name}
                  initials={author.initials}
                  color={author.color}
                  size="md"
                />
              ) : (
                <span className="h-6 w-6 shrink-0 rounded-full bg-slate-200" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">
                    {author?.name ?? 'Unknown'}
                  </span>
                  <span className="text-[12px] text-muted">{ago(comment.createdAt)}</span>
                </div>
                <div className="mt-0.5 rounded-md border border-line bg-canvas px-2.5 py-2">
                  <Markdown content={comment.body} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="mt-3 flex gap-2.5">
        {me && (
          <Avatar name={me.name} initials={me.initials} color={me.color} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter alone inserts a newline; the comment is markdown and
              // multi-line comments are the common case here.
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Leave a comment… markdown is supported"
            className="w-full resize-y rounded-md border border-line bg-white px-2.5 py-2 text-[12.5px] text-ink placeholder:text-muted focus:border-kiran/40 focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[12px] text-muted">⌘/Ctrl + Enter to post</span>
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="rounded-md bg-kiran px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Comment
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

/**
 * Turn one recorded change into a sentence.
 *
 * Activity entries store resolved names rather than ids — see the note in the
 * store — so a feed entry still reads correctly after a state is renamed or a
 * label deleted. Assignee entries are the exception: they store ids, because
 * they are written as a list, so they are resolved here.
 */
function describe(entry: Activity): React.ReactNode {
  const from = entry.from;
  const to = entry.to;

  const names = (raw: string | null) =>
    raw
      ? raw
          .split(',')
          .map((id) => personById(id.trim())?.name ?? 'someone')
          .join(', ')
      : null;

  switch (entry.field) {
    case 'created':
      return <>created this work item</>;

    case 'assignee': {
      const before = names(from);
      const after = names(to);
      if (!before && after) return <>assigned it to <Strong>{after}</Strong></>;
      if (before && !after) return <>unassigned <Strong>{before}</Strong></>;
      return (
        <>
          changed assignee from <Strong>{before}</Strong> to <Strong>{after}</Strong>
        </>
      );
    }

    case 'assigneeIds': {
      const before = names(from);
      const after = names(to);
      if (!after) return <>cleared the assignees</>;
      if (!before) return <>assigned it to <Strong>{after}</Strong></>;
      return (
        <>
          changed assignees to <Strong>{after}</Strong>
        </>
      );
    }

    case 'state':
    case 'stateId':
      return (
        <>
          moved it from <Strong>{from ?? 'none'}</Strong> to <Strong>{to ?? 'none'}</Strong>
        </>
      );

    case 'labelIds':
      if (!to) return <>removed all labels</>;
      return <>set labels to <Strong>{to}</Strong></>;

    case 'dueDate':
      if (!to) return <>cleared the due date</>;
      return <>set the due date to <Strong>{to}</Strong></>;

    case 'startDate':
      if (!to) return <>cleared the start date</>;
      return <>set the start date to <Strong>{to}</Strong></>;

    case 'estimate':
      if (!to) return <>cleared the estimate</>;
      return <>set the estimate to <Strong>{to} points</Strong></>;

    case 'priority':
      return (
        <>
          changed priority from <Strong>{from ?? 'none'}</Strong> to <Strong>{to ?? 'none'}</Strong>
        </>
      );

    case 'cycleId':
      return to ? <>added it to <Strong>{to}</Strong></> : <>removed it from its cycle</>;

    case 'moduleId':
      return to ? <>added it to <Strong>{to}</Strong></> : <>removed it from its module</>;

    case 'parentId':
      return to ? <>made it a sub-item of <Strong>{to}</Strong></> : <>removed its parent</>;

    case 'title':
      return <>renamed it to <Strong>{to}</Strong></>;

    default:
      return (
        <>
          changed <Strong>{entry.field}</Strong>
          {to && <> to <Strong>{to}</Strong></>}
        </>
      );
  }
}

const Strong: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-medium text-ink">{children}</span>
);

export const ActivityFeed: React.FC<{ workItemId: string }> = ({ workItemId }) => {
  const { state } = useProjects();
  const entries = activityFor(state, workItemId);

  if (entries.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
        <History className="h-3.5 w-3.5 text-slate-400" />
        Activity
        <span className="font-mono text-[12px] text-muted">{entries.length}</span>
      </h3>

      <ol className="space-y-2 border-l border-line pl-3.5">
        {entries.map((entry) => {
          const actor = personById(entry.actorId);
          return (
            <li key={entry.id} className="relative text-[12px] leading-relaxed text-muted">
              <span
                aria-hidden
                className="absolute -left-[18px] top-1.5 h-1.5 w-1.5 rounded-full bg-slate-300"
              />
              <Strong>{actor?.name ?? 'Someone'}</Strong> {describe(entry)}
              <span className="ml-1 text-[12px] text-slate-400">{ago(entry.at)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};


/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

/**
 * Logged time on one work item.
 *
 * Hours entered here feed the project's cost burn and the per-member hours
 * chart directly — there is no separate timesheet store, so what you log on an
 * item is what the reporting screen adds up.
 */
export const TimeLog: React.FC<{ workItemId: string }> = ({ workItemId }) => {
  const { state, logTime, dispatch, currentUserId } = useProjects();
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');

  const entries = timeEntriesFor(state, workItemId);
  const total = entries.reduce((sum, entry) => sum + entry.hours, 0);

  const submit = () => {
    const value = Number(hours);
    // Reject nonsense rather than storing NaN and poisoning every rollup.
    if (!Number.isFinite(value) || value <= 0 || value > 24) return;

    logTime({
      workItemId,
      userId: currentUserId,
      date: format(new Date(), 'yyyy-MM-dd'),
      hours: Math.round(value * 10) / 10,
      note: note.trim(),
    });
    setHours('');
    setNote('');
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
        <Timer className="h-3.5 w-3.5 text-slate-400" />
        Time
        {total > 0 && (
          <span className="font-mono text-[12px] text-muted">
            {Math.round(total * 10) / 10}h · {formatINR(Math.round(total * BLENDED_HOURLY_RATE_INR))}
          </span>
        )}
      </h3>

      {entries.length > 0 && (
        <ul className="mb-2 divide-y divide-line-2 rounded-md border border-line">
          {entries.map((entry) => {
            const who = personById(entry.userId);
            return (
              <li key={entry.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                <span className="w-16 shrink-0 font-mono text-[12px] text-muted">
                  {format(parseISO(entry.date), 'd MMM')}
                </span>
                <span className="w-11 shrink-0 font-mono font-semibold text-ink">
                  {entry.hours}h
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {entry.note || '—'}
                </span>
                <span className="shrink-0 text-[12px] text-muted">{who?.name ?? ''}</span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'timeEntry/delete', id: entry.id })}
                  aria-label="Delete time entry"
                  className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-strand-red"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          inputMode="decimal"
          placeholder="Hours"
          className="w-20 rounded-md border border-line px-2 py-1.5 text-[12.5px] focus:border-kiran/40 focus:outline-none"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          placeholder="What did you work on?"
          className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-[12.5px] focus:border-kiran/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!hours.trim()}
          className="shrink-0 rounded-md bg-kiran px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Log
        </button>
      </div>
    </section>
  );
};
