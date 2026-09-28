import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '@/lib/chat-store';
import type { UserId } from '@/lib/chat-types';
import { Row, Screen, Section } from '~/components/Screen';
import { Sheet, SheetButton } from '~/components/Sheet';
import { PersonAvatar } from '~/components/Avatar';
import { PeoplePicker } from '~/components/Pickers';

/** Start something: a direct message, a group, or joining one by its code. */
export function NewChatScreen() {
  const navigate = useNavigate();
  const { users, currentUserId, openDirect, joinByCode } = useChat();
  const [query, setQuery] = useState('');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users
      .filter(
        (user) =>
          user.id !== currentUserId &&
          (!needle ||
            user.name.toLowerCase().includes(needle) ||
            user.role.toLowerCase().includes(needle) ||
            (user.department ?? '').toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, currentUserId, query]);

  return (
    <Screen back title="New chat">
      <div className="bg-surface px-4 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="h-9 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {!query && (
        <Section>
          <Row onClick={() => navigate('/chats/new-group')}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-brand">
              <Users className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[15px] font-medium text-brand">New group</span>
          </Row>
          <Row onClick={() => setJoining(true)}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-brand">
              <Hash className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[15px] font-medium text-brand">Join with a code</span>
          </Row>
        </Section>
      )}

      <Section title="People">
        {people.map((user) => (
          <Row
            key={user.id}
            onClick={() => navigate(`/chats/${openDirect(user.id)}`, { replace: true })}
          >
            <PersonAvatar user={user} size={40} showStatus />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] text-ink">{user.name}</p>
              <p className="truncate text-[12px] text-slate-500">
                {user.department ? `${user.role} · ${user.department}` : user.role}
              </p>
            </div>
          </Row>
        ))}
      </Section>

      {joining && (
        <Sheet onClose={() => setJoining(false)} title="Join with a code">
          <div className="px-4 pb-3 pt-2">
            <input
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Invite code"
              aria-label="Invite code"
              autoCapitalize="characters"
              className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 font-mono text-[16px] tracking-wide text-ink outline-none focus:border-brand"
            />
          </div>
          <SheetButton
            tone="brand"
            disabled={!code.trim()}
            onClick={() => {
              const { room, error } = joinByCode(code.trim());
              if (!room) {
                toast.error(error ?? 'That code does not work.');
                return;
              }
              setJoining(false);
              navigate(`/chats/${room.id}`, { replace: true });
            }}
          >
            Join
          </SheetButton>
        </Sheet>
      )}
    </Screen>
  );
}

/** Pick people, then name it. Unnamed, it is a group chat named after its members. */
export function NewGroupScreen() {
  const navigate = useNavigate();
  const { createGroup, createGroupDm } = useChat();
  const [picked, setPicked] = useState<UserId[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = () => {
    const roomId = name.trim()
      ? createGroup({ name: name.trim(), description: description.trim(), participantIds: picked })
      : createGroupDm(picked);
    navigate(`/chats/${roomId}`, { replace: true });
  };

  if (naming) {
    return (
      <Screen
        back={() => setNaming(false)}
        title="New group"
        action={
          <button
            type="button"
            onClick={create}
            className="px-2 text-[15px] font-semibold text-brand"
          >
            Create
          </button>
        }
      >
        <div className="space-y-3 bg-surface p-4">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Group name (optional)"
            aria-label="Group name"
            className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-[16px] text-ink outline-none focus:border-brand"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is it for? (optional)"
            aria-label="Description"
            rows={3}
            className="w-full resize-none rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-[16px] text-ink outline-none focus:border-brand"
          />
          <p className="text-[12px] text-slate-500">
            {picked.length + 1} members, including you. Without a name it is a group chat named
            after the people in it.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      back
      title="Add people"
      subtitle={picked.length ? `${picked.length} selected` : undefined}
      action={
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={() => setNaming(true)}
          className="px-2 text-[15px] font-semibold text-brand disabled:opacity-40"
        >
          Next
        </button>
      }
    >
      <PeoplePicker picked={picked} onChange={setPicked} />
    </Screen>
  );
}
