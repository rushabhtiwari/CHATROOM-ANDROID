import { useNavigate } from 'react-router-dom';
import { Archive, Bookmark, Check, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { Row, Screen, Section } from '~/components/Screen';
import { PersonAvatar } from '~/components/Avatar';
import { isNative, platform } from '~/native/platform';
import { useDeviceStorageFailing } from '~/lib/useDeviceStorage';

/**
 * Who you are, and what the app is doing.
 *
 * Switching person is a stand-in. The console has no authentication — the
 * current user is chosen from a seeded directory — so until identity wiring
 * lands (sub-project #1) this is the honest equivalent of signing in, and it
 * says so rather than being dressed up as a profile.
 */
export function MeScreen() {
  const navigate = useNavigate();
  const {
    users,
    currentUser,
    setCurrentUserId,
    online,
    storageStatus,
    savedMessages,
    archivedRooms,
  } = useChat();
  const deviceFailing = useDeviceStorageFailing();

  return (
    <Screen title="Me">
      <Section>
        <Row onClick={() => navigate(`/people/${currentUser.id}`)}>
          <PersonAvatar user={currentUser} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-ink">{currentUser.name}</p>
            <p className="truncate text-[13px] text-slate-500">
              {currentUser.role}
              {currentUser.department ? ` · ${currentUser.department}` : ''}
            </p>
            <p className="text-[13px] font-medium text-brand">
              {currentUser.photo ? 'View profile' : 'Add a profile photo'}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Row>
      </Section>

      <Section>
        <Row onClick={() => navigate('/saved')}>
          <Bookmark className="h-5 w-5 text-brand" />
          <span className="flex-1 text-[15px] text-ink">Saved messages</span>
          <span className="text-[14px] text-slate-500">{savedMessages().length}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Row>
        <Row onClick={() => navigate('/chats/archived')}>
          <Archive className="h-5 w-5 text-brand" />
          <span className="flex-1 text-[15px] text-ink">Archived chats</span>
          <span className="text-[14px] text-slate-500">{archivedRooms.length}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Row>
      </Section>

      <Section title="Connection">
        <Row>
          {online ? (
            <Wifi className="h-4 w-4 text-online" />
          ) : (
            <WifiOff className="h-4 w-4 text-strand-amber" />
          )}
          <span className="flex-1 text-[15px] text-ink">{online ? 'Online' : 'Offline'}</span>
          <span className="text-[13px] text-slate-500">{isNative ? platform : 'browser'}</span>
        </Row>
        <Row>
          <span className="flex-1 text-[15px] text-ink">Storage</span>
          <span
            className={
              deviceFailing
                ? 'text-[13px] font-medium text-strand-amber'
                : 'text-[13px] text-slate-500'
            }
          >
            {deviceFailing
              ? 'Not saving to this phone'
              : storageStatus?.reason === 'quota'
                ? 'Full'
                : storageStatus?.reason === 'unavailable'
                  ? 'Unavailable'
                  : 'Healthy'}
          </span>
        </Row>
      </Section>

      <Section title="Signed in as">
        {users.map((user) => (
          <Row key={user.id} onClick={() => setCurrentUserId(user.id)}>
            <PersonAvatar user={user} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] text-ink">{user.name}</p>
              <p className="truncate text-[12px] text-slate-500">{user.role}</p>
            </div>
            {user.id === currentUser.id && (
              <Check className="h-5 w-5 shrink-0 text-brand" aria-label="Current" />
            )}
          </Row>
        ))}
      </Section>

      <p className="px-4 py-4 text-[12px] leading-relaxed text-slate-400">
        Switching people stands in for signing in. The platform identity service is not yet wired to
        this console, so there is no real session to change.
      </p>
    </Screen>
  );
}
