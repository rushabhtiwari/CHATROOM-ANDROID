import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  Bell,
  CalendarClock,
  Camera,
  ChevronRight,
  Copy,
  Images,
  Link2,
  LogOut,
  Pencil,
  Pin,
  Search,
  Sparkles,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '@/lib/chat-store';
import type { NotificationLevel, UserId } from '@/lib/chat-types';
import { sharedContentOf, sharedItemCount } from '@/lib/shared-content';
import { cn } from '@/lib/utils';
import { Empty, Row, Screen, Section } from '~/components/Screen';
import { ConfirmSheet, Sheet, SheetButton } from '~/components/Sheet';
import { PersonAvatar } from '~/components/Avatar';
import { RoomAvatar } from '~/components/RoomAvatar';
import { PhotoEditorSheet } from '~/components/PhotoEditorSheet';
import { PeoplePicker } from '~/components/Pickers';
import { upcomingTime } from '~/lib/format';
import { tap } from '~/native/haptics';

const LEVELS: { value: NotificationLevel; label: string; detail: string }[] = [
  { value: 'all', label: 'All messages', detail: 'Every new message' },
  { value: 'mentions', label: 'Mentions only', detail: 'When someone @mentions you' },
  { value: 'none', label: 'Nothing', detail: 'No notifications from this chat' },
];

const EXPIRY_OPTIONS = [
  { label: '24 hours', value: 86_400_000 },
  { label: '7 days', value: 7 * 86_400_000 },
  { label: '30 days', value: 30 * 86_400_000 },
  { label: 'Never', value: null },
];

const USES_OPTIONS = [
  { label: '1 use', value: 1 },
  { label: '10 uses', value: 10 },
  { label: '50 uses', value: 50 },
  { label: 'Unlimited', value: null },
];

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error('Could not copy. Long-press the text to copy it instead.');
  }
}

type Editing = 'name' | 'topic' | 'description' | null;

/** A text field in a sheet: rename, topic, description. */
function EditSheet({
  title,
  initial,
  multiline,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  multiline?: boolean;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const Field = multiline ? 'textarea' : 'input';
  return (
    <Sheet onClose={onClose} title={title}>
      <div className="px-4 pb-3 pt-2">
        <Field
          autoFocus
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
            setValue(event.target.value)
          }
          aria-label={title}
          rows={multiline ? 4 : undefined}
          className="w-full resize-none rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-[16px] text-ink outline-none focus:border-brand"
        />
      </div>
      <SheetButton
        tone="brand"
        onClick={() => {
          onSave(value.trim());
          onClose();
        }}
      >
        Save
      </SheetButton>
      <SheetButton onClick={onClose}>Cancel</SheetButton>
    </Sheet>
  );
}

/**
 * Everything about a conversation that is not its messages.
 *
 * A direct message is really a person, so its info is their profile.
 */
export function RoomInfoScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const chat = useChat();
  const {
    rooms,
    currentUserId,
    userById,
    roomTitle,
    isAdmin,
    messages,
    pinnedMessages,
    scheduledMessages,
    notificationLevel,
    setNotificationLevel,
    renameRoom,
    setRoomTopic,
    setRoomDescription,
    updateGroupPhoto,
    addMembers,
    removeMember,
    toggleAdmin,
    toggleUserMute,
    toggleGroupMute,
    leaveRoom,
    setArchived,
    createInvite,
    revokeInvite,
    inviteStatus,
    openDirect,
    summarizeRoom,
    notificationsFor,
  } = chat;

  const room = rooms.find((candidate) => candidate.id === roomId);
  const [editing, setEditing] = useState<Editing>(null);
  const [photo, setPhoto] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [adding, setAdding] = useState<UserId[] | null>(null);
  const [member, setMember] = useState<UserId | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [expiry, setExpiry] = useState<number | null>(7 * 86_400_000);
  const [maxUses, setMaxUses] = useState<number | null>(50);
  // Everything here that cannot be undone with one tap asks first.
  const [confirm, setConfirm] = useState<'leave' | 'revoke' | null>(null);
  const [removing, setRemoving] = useState<UserId | null>(null);

  const shared = useMemo(
    () => sharedContentOf(messages.filter((message) => message.roomId === roomId)),
    [messages, roomId],
  );

  if (!room) {
    return (
      <Screen back title="Info">
        <Empty title="Conversation not found" />
      </Screen>
    );
  }

  if (room.type === 'direct') {
    const other = room.participantIds.find((id) => id !== currentUserId);
    if (other) return <Navigate to={`/people/${other}`} replace />;
  }

  const admin = isAdmin(room, currentUserId);
  // The store will not let the last admin leave a group that still has other
  // members. Knowing that here keeps the person on this screen, where "Make
  // admin" is, instead of dropping them on the chat list with a toast.
  const lastAdmin =
    room.adminIds.length === 1 &&
    room.adminIds[0] === currentUserId &&
    room.participantIds.length > 1;
  const member_ = room.participantIds.includes(currentUserId);
  const isGroup = room.type === 'group';
  const level = notificationLevel(room.id);
  const pinned = pinnedMessages(room.id);
  const scheduled = scheduledMessages(room.id);
  const activity = notificationsFor(room.id);
  const invite = room.invite;
  const status = inviteStatus(invite);
  const members = [...room.participantIds].sort((a, b) => {
    // You first, then admins, then everyone else by name.
    if (a === currentUserId) return -1;
    if (b === currentUserId) return 1;
    const adminA = room.adminIds.includes(a) ? 0 : 1;
    const adminB = room.adminIds.includes(b) ? 0 : 1;
    return adminA - adminB || userById(a).name.localeCompare(userById(b).name);
  });
  const selected = member ? userById(member) : null;

  return (
    <Screen back title={room.type === 'groupdm' ? 'Group chat' : 'Group info'}>
      <div className="flex flex-col items-center bg-surface px-6 pb-5 pt-6">
        <div className="relative">
          <RoomAvatar room={room} size={96} />
          {member_ && (
            <button
              type="button"
              onClick={() => {
                tap();
                setPhoto(true);
              }}
              aria-label="Change group photo"
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-brand text-white shadow"
            >
              <Camera className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          disabled={!admin}
          onClick={() => setEditing('name')}
          className="mt-3 flex items-center gap-1.5 text-center text-[21px] font-semibold text-ink"
        >
          {roomTitle(room)}
          {admin && <Pencil className="h-4 w-4 text-slate-400" />}
        </button>
        <p className="text-[14px] text-slate-500">
          {room.participantIds.length} {room.participantIds.length === 1 ? 'member' : 'members'}
        </p>
        <div className="mt-4 grid w-full grid-cols-3 gap-2">
          {[
            {
              label: 'Search',
              icon: <Search className="h-5 w-5" />,
              run: () => navigate(`/chats/search?room=${room.id}`),
            },
            {
              label: 'Summarize',
              icon: <Sparkles className="h-5 w-5" />,
              run: () => {
                void summarizeRoom(room.id);
                navigate(`/chats/${room.id}?assistant=1`);
              },
            },
            {
              label: level === 'all' ? 'Mute' : 'Unmute',
              icon:
                level === 'all' ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />,
              run: () => setNotificationLevel(room.id, level === 'all' ? 'none' : 'all'),
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
      </div>

      <Section title="About">
        <Row onClick={admin ? () => setEditing('topic') : undefined}>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-slate-500">Topic</p>
            <p className={cn('text-[15px]', room.topic ? 'text-ink' : 'text-slate-400')}>
              {room.topic || (admin ? 'Add a topic' : 'No topic')}
            </p>
          </div>
          {admin && <ChevronRight className="h-4 w-4 text-slate-400" />}
        </Row>
        <Row onClick={admin ? () => setEditing('description') : undefined}>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-slate-500">Description</p>
            <p
              className={cn(
                'whitespace-pre-wrap text-[15px]',
                room.description ? 'text-ink' : 'text-slate-400',
              )}
            >
              {room.description || (admin ? 'Add a description' : 'No description')}
            </p>
          </div>
          {admin && <ChevronRight className="h-4 w-4 text-slate-400" />}
        </Row>
      </Section>

      <Section>
        <Row onClick={() => navigate(`/chats/${room.id}/media`)}>
          <Images className="h-5 w-5 text-brand" />
          <span className="flex-1 text-[15px] text-ink">Media, links and docs</span>
          <span className="text-[14px] text-slate-500">{sharedItemCount(shared)}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Row>
        <Row onClick={() => navigate(`/chats/${room.id}/pinned`)}>
          <Pin className="h-5 w-5 text-brand" />
          <span className="flex-1 text-[15px] text-ink">Pinned messages</span>
          <span className="text-[14px] text-slate-500">{pinned.length}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Row>
        <Row onClick={() => navigate(`/chats/${room.id}/scheduled`)}>
          <CalendarClock className="h-5 w-5 text-brand" />
          <span className="flex-1 text-[15px] text-ink">Scheduled messages</span>
          <span className="text-[14px] text-slate-500">{scheduled.length}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Row>
        <Row onClick={() => navigate(`/chats/${room.id}/activity`)}>
          <Bell className="h-5 w-5 text-brand" />
          <span className="flex-1 text-[15px] text-ink">Activity</span>
          <span className="text-[14px] text-slate-500">{activity.length}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Row>
      </Section>

      <Section title="Notifications">
        <Row onClick={() => setLevelOpen(true)}>
          <Bell className="h-5 w-5 text-brand" />
          <span className="flex-1 text-[15px] text-ink">Notify me about</span>
          <span className="text-[14px] text-slate-500">
            {LEVELS.find((option) => option.value === level)?.label}
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Row>
        {admin && isGroup && (
          <Row onClick={() => toggleGroupMute(room.id)}>
            <VolumeX className="h-5 w-5 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-ink">Only admins can send</p>
              <p className="text-[12px] text-slate-500">Everyone else can read and react</p>
            </div>
            <span
              role="switch"
              aria-checked={Boolean(room.groupMuted)}
              aria-label="Only admins can send"
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                room.groupMuted ? 'bg-brand' : 'bg-slate-200',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
                  room.groupMuted ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </span>
          </Row>
        )}
      </Section>

      {isGroup && (
        <Section title="Invite link">
          {invite && status === 'active' ? (
            <>
              <Row onClick={() => copy(invite.code, 'Invite code copied')}>
                <Link2 className="h-5 w-5 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[15px] tracking-wide text-ink">{invite.code}</p>
                  <p className="text-[12px] text-slate-500">
                    {invite.expiresAt
                      ? `Expires ${upcomingTime(invite.expiresAt)}`
                      : 'Never expires'}{' '}
                    · {invite.maxUses ? `${invite.uses}/${invite.maxUses} uses` : 'unlimited uses'}
                  </p>
                </div>
                <Copy className="h-4 w-4 text-slate-400" />
              </Row>
              {admin && (
                <Row onClick={() => setConfirm('revoke')} className="text-destructive">
                  <span className="flex-1 text-[15px]">Revoke link</span>
                </Row>
              )}
            </>
          ) : (
            <Row>
              <span className="flex-1 text-[14px] text-slate-500">
                {status === 'expired'
                  ? 'The last link has expired.'
                  : status === 'exhausted'
                    ? 'The last link has been used up.'
                    : 'No invite link is active.'}
              </span>
            </Row>
          )}
          {admin && (
            <Row onClick={() => setInviteOpen(true)}>
              <span className="flex-1 text-[15px] font-medium text-brand">
                {invite ? 'Generate a new link' : 'Create an invite link'}
              </span>
            </Row>
          )}
        </Section>
      )}

      <Section title={`${room.participantIds.length} members`}>
        {(admin || room.type === 'groupdm') && (
          <Row onClick={() => setAdding([])}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-brand">
              <UserPlus className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[15px] font-medium text-brand">Add members</span>
          </Row>
        )}
        {members.map((id) => {
          const user = userById(id);
          const memberIsAdmin = room.adminIds.includes(id);
          const muted = room.mutedUserIds.includes(id);
          return (
            <Row
              key={id}
              onClick={() => (id === currentUserId ? navigate(`/people/${id}`) : setMember(id))}
            >
              <PersonAvatar user={user} size={36} showStatus />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-ink">
                  {id === currentUserId ? 'You' : user.name}
                </p>
                <p className="truncate text-[12px] text-slate-500">
                  {muted ? 'Muted · ' : ''}
                  {user.role}
                </p>
              </div>
              {memberIsAdmin && (
                <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-brand">
                  Admin
                </span>
              )}
            </Row>
          );
        })}
      </Section>

      <Section>
        <Row onClick={() => setArchived(room.id, !room.archived)}>
          <Archive className="h-5 w-5 text-brand" />
          <span className="flex-1 text-[15px] text-ink">
            {room.archived ? 'Unarchive chat' : 'Archive chat'}
          </span>
        </Row>
        {member_ && (
          <Row onClick={() => setConfirm('leave')} className="text-destructive">
            <LogOut className="h-5 w-5" />
            <span className="flex-1 text-[15px]">Leave group</span>
          </Row>
        )}
      </Section>
      <div className="h-6" />

      {editing && (
        <EditSheet
          title={editing === 'name' ? 'Group name' : editing === 'topic' ? 'Topic' : 'Description'}
          initial={
            (editing === 'name'
              ? room.name
              : editing === 'topic'
                ? room.topic
                : room.description) ?? ''
          }
          multiline={editing === 'description'}
          onSave={(value) => {
            if (editing === 'name') {
              if (value && value !== room.name) renameRoom(room.id, value);
            } else if (editing === 'topic') {
              if (value !== (room.topic ?? '')) setRoomTopic(room.id, value);
            } else if (value !== (room.description ?? '')) {
              setRoomDescription(room.id, value);
            }
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {photo && (
        <PhotoEditorSheet
          title="Group photo"
          current={room.photo}
          onSave={(next) => updateGroupPhoto(room.id, next)}
          onClose={() => setPhoto(false)}
        />
      )}

      {levelOpen && (
        <Sheet onClose={() => setLevelOpen(false)} title="Notify me about">
          {LEVELS.map((option) => (
            <SheetButton
              key={option.value}
              tone={option.value === level ? 'brand' : 'default'}
              onClick={() => {
                setNotificationLevel(room.id, option.value);
                setLevelOpen(false);
              }}
            >
              <span className="block">{option.label}</span>
              <span className="block text-[12px] font-normal text-slate-500">{option.detail}</span>
            </SheetButton>
          ))}
        </Sheet>
      )}

      {adding && (
        <Sheet onClose={() => setAdding(null)} title="Add members">
          <div className="max-h-[55vh] overflow-y-auto">
            <PeoplePicker exclude={room.participantIds} picked={adding} onChange={setAdding} />
          </div>
          <div className="border-t border-line p-3">
            <button
              type="button"
              disabled={adding.length === 0}
              onClick={() => {
                addMembers(room.id, adding);
                setAdding(null);
              }}
              className="h-11 w-full rounded-xl bg-brand text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {adding.length > 1 ? `Add ${adding.length} people` : 'Add'}
            </button>
          </div>
        </Sheet>
      )}

      {selected && (
        <Sheet onClose={() => setMember(null)} title={selected.name}>
          <SheetButton onClick={() => navigate(`/people/${selected.id}`)}>View profile</SheetButton>
          <SheetButton onClick={() => navigate(`/chats/${openDirect(selected.id)}`)}>
            Message {selected.name.split(' ')[0]}
          </SheetButton>
          {admin && isGroup && (
            <>
              <SheetButton
                onClick={() => {
                  toggleAdmin(room.id, selected.id);
                  setMember(null);
                }}
              >
                {room.adminIds.includes(selected.id) ? 'Remove as admin' : 'Make admin'}
              </SheetButton>
              <SheetButton
                onClick={() => {
                  toggleUserMute(room.id, selected.id);
                  setMember(null);
                }}
              >
                {room.mutedUserIds.includes(selected.id)
                  ? 'Let them send again'
                  : 'Mute in this group'}
              </SheetButton>
              <SheetButton
                tone="danger"
                onClick={() => {
                  setMember(null);
                  setRemoving(selected.id);
                }}
              >
                Remove from group
              </SheetButton>
            </>
          )}
          <SheetButton onClick={() => setMember(null)}>Cancel</SheetButton>
        </Sheet>
      )}

      {inviteOpen && (
        <Sheet onClose={() => setInviteOpen(false)} title="New invite link">
          <div className="space-y-3 px-4 pb-3 pt-1">
            {[
              { label: 'Expires after', options: EXPIRY_OPTIONS, value: expiry, set: setExpiry },
              { label: 'Usage limit', options: USES_OPTIONS, value: maxUses, set: setMaxUses },
            ].map((choice) => (
              <div key={choice.label}>
                <p className="pb-1.5 text-[12px] font-semibold text-slate-500">{choice.label}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {choice.options.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={choice.value === option.value}
                      onClick={() => choice.set(option.value)}
                      className={cn(
                        'h-9 rounded-lg text-[13px] font-medium',
                        choice.value === option.value
                          ? 'bg-brand text-white'
                          : 'bg-slate-100 text-ink',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[12px] text-slate-500">
              A new link replaces the old one straight away.
            </p>
          </div>
          <SheetButton
            tone="brand"
            onClick={() => {
              createInvite(room.id, { expiresInMs: expiry, maxUses });
              setInviteOpen(false);
            }}
          >
            Generate link
          </SheetButton>
        </Sheet>
      )}

      {confirm === 'leave' && lastAdmin && (
        <Sheet onClose={() => setConfirm(null)} title="Make someone else an admin first">
          <p className="px-6 pb-3 text-center text-[13px] text-slate-500">
            You are the only admin of {roomTitle(room)}. Tap a member and choose Make admin, then
            you can leave.
          </p>
          <SheetButton onClick={() => setConfirm(null)}>
            <span className="block text-center">OK</span>
          </SheetButton>
        </Sheet>
      )}

      {confirm === 'leave' && !lastAdmin && (
        <ConfirmSheet
          title={`Leave ${roomTitle(room)}?`}
          detail="You will stop getting its messages. Someone will have to add you back."
          confirm="Leave group"
          onConfirm={() => {
            leaveRoom(room.id);
            navigate('/chats', { replace: true });
          }}
          onClose={() => setConfirm(null)}
        />
      )}

      {confirm === 'revoke' && (
        <ConfirmSheet
          title="Revoke this invite link?"
          detail="Anyone who has it can no longer join with it. You can generate a new one."
          confirm="Revoke link"
          onConfirm={() => revokeInvite(room.id)}
          onClose={() => setConfirm(null)}
        />
      )}

      {removing && (
        <ConfirmSheet
          title={`Remove ${userById(removing).name}?`}
          detail={`They will stop getting messages from ${roomTitle(room)}. You can add them back later.`}
          confirm="Remove from group"
          onConfirm={() => removeMember(room.id, removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </Screen>
  );
}
