import { Check, Wifi, WifiOff } from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { Row, Screen, Section } from '~/components/Screen';
import { isNative, platform } from '~/native/platform';

/**
 * Who you are, and what the app is doing.
 *
 * Switching person is a stand-in. The console has no authentication — the
 * current user is chosen from a seeded directory — so until identity wiring
 * lands (sub-project #1) this is the honest equivalent of signing in, and it
 * says so rather than being dressed up as a profile.
 */
export function MeScreen() {
  const { users, currentUser, setCurrentUserId, online, storageStatus } = useChat();

  return (
    <Screen title="Me">
      <Section>
        <Row>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold text-white"
            style={{ backgroundColor: currentUser.color }}
            aria-hidden
          >
            {currentUser.name
              .split(' ')
              .slice(0, 2)
              .map((word) => word[0])
              .join('')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-ink">{currentUser.name}</p>
            <p className="truncate text-[13px] text-slate-500">
              {currentUser.role}
              {currentUser.department ? ` · ${currentUser.department}` : ''}
            </p>
          </div>
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
          <span className="text-[13px] text-slate-500">
            {storageStatus?.reason === 'quota'
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
            <span
              className="h-8 w-8 shrink-0 rounded-full"
              style={{ backgroundColor: user.color }}
              aria-hidden
            />
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
