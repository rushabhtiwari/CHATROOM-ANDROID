import { Users } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { Room } from '@/lib/chat-types';
import { cn } from '@/lib/utils';

/**
 * A conversation's picture.
 *
 * Group photo if one was set, otherwise initials on the room's own colour.
 * Direct messages carry the other person's presence dot, because on a phone
 * the list row is the only place you will see it.
 */
export function RoomAvatar({ room, size = 44 }: { room: Room; size?: number }) {
  const { roomTitle, currentUserId, userById } = useChat();
  const title = roomTitle(room);

  const other =
    room.type === 'direct'
      ? room.participantIds.find((id) => id !== currentUserId)
      : undefined;
  const otherUser = other ? userById(other) : undefined;

  const initials = title
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {room.photo?.dataUrl ? (
        <img
          src={room.photo.dataUrl}
          alt=""
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full text-[15px] font-semibold text-white"
          style={{ backgroundColor: otherUser?.color ?? room.color ?? '#0A63C9' }}
          aria-hidden
        >
          {room.type === 'group' && !initials ? (
            <Users className="h-5 w-5" />
          ) : (
            initials
          )}
        </div>
      )}

      {otherUser && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface',
            otherUser.online ? 'bg-online' : 'bg-slate-300',
          )}
          aria-label={otherUser.online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
