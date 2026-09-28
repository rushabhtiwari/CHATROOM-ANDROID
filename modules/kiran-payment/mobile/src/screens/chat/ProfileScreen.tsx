import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Camera,
  ChevronRight,
  Clock,
  Globe2,
  Images,
  Mail,
  MessageCircle,
  Share2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '@/lib/chat-store';
import { sharedContentOf, sharedItemCount } from '@/lib/shared-content';
import { Empty, Row, Screen, Section } from '~/components/Screen';
import { PersonAvatar } from '~/components/Avatar';
import { RoomAvatar } from '~/components/RoomAvatar';
import { PhotoEditorSheet } from '~/components/PhotoEditorSheet';
import { RoomPickerSheet } from '~/components/Pickers';
import { tap } from '~/native/haptics';

/** Their local time, which is what you want to know before you message them. */
function localTime(timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date());
  } catch {
    return null;
  }
}

/**
 * A person: who they are, what the two of you have shared, the groups you
 * are both in. Your own profile is where you set your photo.
 */
export function ProfileScreen() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const {
    users,
    userById,
    currentUserId,
    rooms,
    messages,
    roomTitle,
    openDirect,
    createGroupDm,
    sendMessage,
    updateProfilePhoto,
  } = useChat();
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [sharing, setSharing] = useState(false);

  const exists = users.some((user) => user.id === userId);
  const user = exists ? userById(userId!) : null;
  const isMe = userId === currentUserId;

  const direct = useMemo(
    () =>
      isMe
        ? undefined
        : rooms.find(
            (room) =>
              room.type === 'direct' &&
              room.participantIds.length === 2 &&
              room.participantIds.includes(currentUserId) &&
              room.participantIds.includes(userId ?? ''),
          ),
    [rooms, currentUserId, userId, isMe],
  );

  const shared = useMemo(
    () => sharedContentOf(direct ? messages.filter((m) => m.roomId === direct.id) : []),
    [messages, direct],
  );

  const inCommon = useMemo(
    () =>
      isMe
        ? []
        : rooms.filter(
            (room) =>
              room.type !== 'direct' &&
              !room.archived &&
              room.participantIds.includes(currentUserId) &&
              room.participantIds.includes(userId ?? ''),
          ),
    [rooms, currentUserId, userId, isMe],
  );

  if (!user) {
    return (
      <Screen back title="Profile">
        <Empty title="Person not found" detail="They may have left the workspace." />
      </Screen>
    );
  }

  const time = localTime(user.timeZone);
  const count = sharedItemCount(shared);

  return (
    <Screen back title={isMe ? 'My profile' : user.name}>
      <div className="flex flex-col items-center bg-surface px-6 pb-5 pt-6">
        <div className="relative">
          <PersonAvatar user={user} size={104} showStatus={!isMe} />
          {isMe && (
            <button
              type="button"
              onClick={() => {
                tap();
                setEditingPhoto(true);
              }}
              aria-label="Change my photo"
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-brand text-white shadow"
            >
              <Camera className="h-4 w-4" />
            </button>
          )}
        </div>
        <h2 className="mt-3 text-center text-[21px] font-semibold text-ink">{user.name}</h2>
        <p className="text-center text-[14px] text-slate-500">
          {user.department ? `${user.role} · ${user.department}` : user.role}
        </p>
        {!isMe && (
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            {user.online ? 'Online now' : 'Offline'}
          </p>
        )}
        {isMe && (
          <button
            type="button"
            onClick={() => setEditingPhoto(true)}
            className="mt-2 text-[14px] font-medium text-brand"
          >
            {user.photo ? 'Change photo' : 'Add a photo'}
          </button>
        )}

        {!isMe && (
          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            {[
              {
                label: 'Message',
                icon: <MessageCircle className="h-5 w-5" />,
                run: () => navigate(`/chats/${openDirect(user.id)}`),
              },
              {
                label: 'New group',
                icon: <UserPlus className="h-5 w-5" />,
                run: () => navigate(`/chats/${createGroupDm([user.id])}`),
              },
              {
                label: 'Share',
                icon: <Share2 className="h-5 w-5" />,
                run: () => setSharing(true),
              },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  tap();
                  action.run();
                }}
                className="flex flex-col items-center gap-1 rounded-xl bg-accent py-3 text-[13px] font-medium text-brand active:opacity-80"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Section title="Details">
        {user.email && (
          <Row onClick={() => window.open(`mailto:${user.email}`)}>
            <Mail className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{user.email}</span>
          </Row>
        )}
        <Row>
          <Globe2 className="h-4 w-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{user.timeZone}</span>
        </Row>
        {time && !isMe && (
          <Row>
            <Clock className="h-4 w-4 shrink-0 text-brand" />
            <span className="flex-1 text-[15px] text-ink">Their time</span>
            <span className="text-[14px] text-slate-500">{time}</span>
          </Row>
        )}
      </Section>

      {!isMe && (
        <Section title="Shared with you">
          <Row onClick={direct ? () => navigate(`/chats/${direct.id}/media`) : undefined}>
            <Images className="h-4 w-4 shrink-0 text-brand" />
            <span className="flex-1 text-[15px] text-ink">Media, links and docs</span>
            <span className="text-[14px] text-slate-500">{count}</span>
            {direct && <ChevronRight className="h-4 w-4 text-slate-400" />}
          </Row>
          {direct && shared.media.length > 0 && (
            <div className="grid grid-cols-4 gap-0.5 p-0.5">
              {shared.media.slice(0, 4).map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => navigate(`/chats/${direct.id}/media`)}
                  className="aspect-square overflow-hidden bg-slate-100"
                >
                  <img
                    src={message.attachment!.dataUrl}
                    alt={message.attachment!.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {inCommon.length > 0 && (
        <Section
          title={`${inCommon.length} ${inCommon.length === 1 ? 'group' : 'groups'} in common`}
        >
          {inCommon.map((room) => (
            <Row key={room.id} onClick={() => navigate(`/chats/${room.id}`)}>
              <RoomAvatar room={room} size={34} />
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                {roomTitle(room)}
              </span>
              <span className="text-[13px] text-slate-500">{room.participantIds.length}</span>
            </Row>
          ))}
        </Section>
      )}

      {editingPhoto && (
        <PhotoEditorSheet
          title="Profile photo"
          current={user.photo}
          onSave={(photo) => {
            updateProfilePhoto(photo);
            toast.success(photo ? 'Photo updated' : 'Photo removed');
          }}
          onClose={() => setEditingPhoto(false)}
        />
      )}

      {sharing && (
        <RoomPickerSheet
          title={`Share ${user.name.split(' ')[0]}'s contact`}
          action="Share"
          onPick={(roomIds) => {
            for (const roomId of roomIds) {
              sendMessage(roomId, `Shared ${user.name}'s contact`, {
                sharedProfileUserId: user.id,
              });
            }
            toast.success(
              roomIds.length === 1 ? 'Contact shared' : `Shared to ${roomIds.length} chats`,
            );
          }}
          onClose={() => setSharing(false)}
        />
      )}
    </Screen>
  );
}
