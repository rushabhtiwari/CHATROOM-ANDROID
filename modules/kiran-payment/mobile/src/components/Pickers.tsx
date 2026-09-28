import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { RoomId, User, UserId } from '@/lib/chat-types';
import { cn } from '@/lib/utils';
import { Sheet } from '~/components/Sheet';
import { RoomAvatar } from '~/components/RoomAvatar';
import { PersonAvatar } from '~/components/Avatar';
import { selection } from '~/native/haptics';

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
        on ? 'border-brand bg-brand text-white' : 'border-slate-300',
      )}
      aria-hidden
    >
      {on && <Check className="h-3.5 w-3.5" />}
    </span>
  );
}

/** Pick one or more conversations: where to forward, where to share a contact. */
export function RoomPickerSheet({
  title,
  action,
  onPick,
  onClose,
}: {
  title: string;
  /** The confirm button's verb, e.g. "Forward". */
  action: string;
  onPick: (roomIds: RoomId[]) => void;
  onClose: () => void;
}) {
  const { visibleRooms, roomTitle, canSend, currentUserId } = useChat();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<RoomId[]>([]);

  const rooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return visibleRooms.filter(
      (room) =>
        canSend(room, currentUserId).allowed &&
        (!needle || roomTitle(room).toLowerCase().includes(needle)),
    );
  }, [visibleRooms, query, roomTitle, canSend, currentUserId]);

  return (
    <Sheet onClose={onClose} title={title}>
      <SearchField value={query} onChange={setQuery} placeholder="Search conversations" />
      <ul className="max-h-[50vh] overflow-y-auto">
        {rooms.map((room) => {
          const on = picked.includes(room.id);
          return (
            <li key={room.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  selection();
                  setPicked((current) =>
                    on ? current.filter((id) => id !== room.id) : [...current, room.id],
                  );
                }}
                className="flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left active:bg-slate-100"
              >
                <RoomAvatar room={room} size={36} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                  {roomTitle(room)}
                </span>
                <Tick on={on} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line p-3">
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={() => {
            onPick(picked);
            onClose();
          }}
          className="h-11 w-full rounded-xl bg-brand text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {picked.length > 1 ? `${action} to ${picked.length} chats` : action}
        </button>
      </div>
    </Sheet>
  );
}

/** Pick people from the directory, e.g. for a new group or to add to one. */
export function PeoplePicker({
  exclude = [],
  picked,
  onChange,
}: {
  exclude?: UserId[];
  picked: UserId[];
  onChange: (next: UserId[]) => void;
}) {
  const { users, currentUserId } = useChat();
  const [query, setQuery] = useState('');

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter(
      (user: User) =>
        user.id !== currentUserId &&
        !exclude.includes(user.id) &&
        (!needle ||
          user.name.toLowerCase().includes(needle) ||
          user.role.toLowerCase().includes(needle) ||
          (user.department ?? '').toLowerCase().includes(needle)),
    );
  }, [users, currentUserId, exclude, query]);

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="Search people" />
      <ul className="divide-y divide-line border-y border-line bg-surface">
        {people.map((user) => {
          const on = picked.includes(user.id);
          return (
            <li key={user.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  selection();
                  onChange(on ? picked.filter((id) => id !== user.id) : [...picked, user.id]);
                }}
                className="flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left active:bg-slate-100"
              >
                <PersonAvatar user={user} size={36} showStatus />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-ink">{user.name}</span>
                  <span className="block truncate text-[12px] text-slate-500">
                    {user.department ? `${user.role} · ${user.department}` : user.role}
                  </span>
                </span>
                <Tick on={on} />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
