import { Users } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import type { Room } from '@/lib/chat-types';
import { FramedPhoto, initialsOf, PersonAvatar } from '~/components/Avatar';

/**
 * A conversation's picture.
 *
 * A direct message is the other person, photo and presence dot included,
 * because on a phone the list row is the only place you will see them. A
 * group shows its photo if one was set, otherwise initials on its colour.
 */
export function RoomAvatar({ room, size = 44 }: { room: Room; size?: number }) {
  const { roomTitle, currentUserId, userById } = useChat();

  const other =
    room.type === 'direct' ? room.participantIds.find((id) => id !== currentUserId) : undefined;
  if (other) return <PersonAvatar user={userById(other)} size={size} showStatus />;

  const initials = initialsOf(roomTitle(room));
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: room.color ?? '#0A63C9' }}
      aria-hidden
    >
      {room.photo?.dataUrl ? (
        <FramedPhoto photo={room.photo} />
      ) : room.type === 'group' && !initials ? (
        <Users className="h-5 w-5" />
      ) : (
        initials
      )}
    </div>
  );
}
