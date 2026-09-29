import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { useChat } from '@/lib/chat-store';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '~/components/Avatar';
import { useCloseOnBack } from '~/native/back-button';
import { tap } from '~/native/haptics';
import { isAndroid } from '~/native/platform';
import { useCalls } from '~/calls/CallProvider';
import type { CallSnapshot, EndReason } from '~/calls/types';

/** "0:07", "12:43", "1:02:09". */
export function callDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

const ENDED: Record<EndReason, string> = {
  ended: 'Call ended',
  'no-answer': 'No answer',
  declined: 'Call declined',
  busy: 'On another call',
  unavailable: 'Could not reach the call server',
  failed: 'Call dropped',
  cancelled: 'Call ended',
  missed: 'Missed call',
  'media-denied': 'Allow the microphone to make calls',
  elsewhere: 'Answered on another device',
};

/** The line under the name: what the call is doing now. */
export function callStatus(call: CallSnapshot, now: number): string {
  switch (call.phase) {
    case 'outgoing':
      return call.ringing ? 'Ringing…' : 'Calling…';
    case 'incoming':
      return call.media === 'video' ? 'Incoming video call' : 'Incoming voice call';
    case 'connecting':
      return 'Connecting…';
    case 'active':
      return call.reconnecting ? 'Reconnecting…' : callDuration(now - (call.connectedAt ?? now));
    case 'ended': {
      const reason = call.ended ?? 'ended';
      const text =
        reason === 'media-denied' && call.media === 'video'
          ? 'Allow the camera and microphone to make video calls'
          : ENDED[reason];
      return call.connectedAt && call.endedAt
        ? `${text} · ${callDuration(call.endedAt - call.connectedAt)}`
        : text;
    }
  }
}

/** A clock that ticks while `running`, for the call timer. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

/** A one-pixel transparent GIF. */
const BLANK_POSTER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** A camera, live. Always muted: the voice plays from one place (CallProvider). */
function VideoView({
  stream,
  version,
  mirrored = false,
  className,
  label,
}: {
  stream: MediaStream | null;
  version: number;
  mirrored?: boolean;
  className?: string;
  label: string;
}) {
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = element.current;
    if (!video) return;
    video.muted = true;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (!stream) return;
    const playing = video.play?.();
    if (playing && typeof playing.catch === 'function') playing.catch(() => undefined);
  }, [stream, version]);
  return (
    <video
      ref={element}
      autoPlay
      playsInline
      muted
      // Android's web view draws a grey play button over a video until its
      // first frame. A transparent poster leaves the black background instead.
      poster={BLANK_POSTER}
      aria-label={label}
      className={cn('bg-black object-cover', mirrored && '-scale-x-100', className)}
    />
  );
}

function RoundButton({
  label,
  onClick,
  pressed,
  tone = 'plain',
  size = 'md',
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  tone?: 'plain' | 'end' | 'answer';
  size?: 'md' | 'lg';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={() => {
        tap();
        onClick();
      }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full transition-colors active:opacity-80',
        size === 'lg' ? 'h-[68px] w-[68px]' : 'h-14 w-14',
        tone === 'end' && 'bg-[#E5484D] text-white',
        tone === 'answer' && 'bg-[#1FA855] text-white',
        tone === 'plain' && (pressed ? 'bg-white text-ink' : 'bg-white/15 text-white'),
      )}
    >
      {children}
    </button>
  );
}

/**
 * The call, on top of everything: who, how long, and the buttons. Android's
 * back button, or the arrow, tucks it into a pill at the top so the rest of
 * the app can be used during a call; tapping the pill brings it back.
 */
export function CallScreen() {
  const calls = useCalls();
  const { userById } = useChat();
  const call = calls.call;
  const open = Boolean(call && !call.minimized && call.phase !== 'ended');
  useCloseOnBack(() => calls.minimize(), open);
  const ticking = call?.phase === 'active';
  const now = useNow(Boolean(ticking));

  if (!call) return null;
  const peer = userById(call.peerId);
  const status = callStatus(call, now);

  if (call.minimized) {
    if (call.phase === 'ended') return null;
    return (
      <button
        type="button"
        onClick={() => {
          tap();
          calls.restore();
        }}
        aria-label={`Return to the call with ${peer.name}`}
        className={cn(
          'absolute left-1/2 top-[calc(env(safe-area-inset-top)+6px)] z-50 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full bg-[#1FA855] px-4 py-2 text-[13px] font-semibold text-white shadow-lg',
          call.phase === 'incoming' && 'animate-pulse',
        )}
      >
        {call.media === 'video' ? (
          <Video className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Phone className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="min-w-0 truncate">{peer.name}</span>
        <span className="shrink-0 tabular-nums opacity-90">{status}</span>
      </button>
    );
  }

  const isVideo = call.media === 'video';
  const connectedish = call.phase === 'connecting' || call.phase === 'active';
  // The other face fills the screen once it arrives, unless they turned it off.
  const remoteFull = isVideo && call.hasRemoteVideo && call.remoteCameraOn && connectedish;
  // Until it arrives, your own camera fills it, as it does in every video call app.
  const waiting =
    call.phase === 'outgoing' || (call.phase === 'connecting' && !call.hasRemoteVideo);
  const localFull = isVideo && call.cameraOn && waiting;
  // Once connected your own camera sits in the corner — also while theirs is
  // off, when their picture takes the middle.
  const localPip = isVideo && connectedish && !waiting;
  const firstName = peer.name.split(' ')[0];

  return (
    <div
      role="dialog"
      aria-label={`Call with ${peer.name}`}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-gradient-to-b from-[#0B2A4A] to-[#02131F] text-white"
    >
      {remoteFull && (
        <VideoView
          stream={calls.remoteStream}
          version={call.streams}
          className="absolute inset-0 h-full w-full"
          label={`${peer.name}'s camera`}
        />
      )}
      {localFull && (
        <VideoView
          stream={calls.localStream}
          version={call.streams}
          mirrored={call.facing === 'user'}
          className="absolute inset-0 h-full w-full"
          label="Your camera"
        />
      )}
      {(remoteFull || localFull) && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/60 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent" />
        </>
      )}

      <header className="relative z-10 flex min-h-[52px] items-center px-2 pt-safe-top">
        {call.phase !== 'ended' ? (
          <button
            type="button"
            onClick={() => {
              tap();
              calls.minimize();
            }}
            aria-label="Minimise the call"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/90 active:bg-white/10"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
        ) : (
          <span className="h-11 w-11" />
        )}
        <p className="flex-1 text-center text-[12px] font-medium tracking-wide text-white/70">
          {isVideo ? 'KiranOS video call' : 'KiranOS voice call'}
        </p>
        <span className="h-11 w-11" />
      </header>

      {remoteFull || localFull ? (
        <div className="relative z-10 px-6 pt-2 text-center">
          {/* White said outright: the console's stylesheet inks every heading. */}
          <h2 className="truncate text-[22px] font-semibold text-white drop-shadow">{peer.name}</h2>
          <p
            className="mt-0.5 text-[14px] tabular-nums text-white/85 drop-shadow"
            aria-live="polite"
          >
            {status}
          </p>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center px-6 pt-10 text-center">
          <div
            className={cn(
              'rounded-full p-1.5',
              (call.phase === 'incoming' || (call.phase === 'outgoing' && call.ringing)) &&
                'animate-pulse bg-white/10',
            )}
          >
            <PersonAvatar user={peer} size={116} />
          </div>
          <h2 className="mt-5 max-w-full truncate text-[26px] font-semibold text-white">
            {peer.name}
          </h2>
          <p className="mt-1 text-[15px] tabular-nums text-white/75" aria-live="polite">
            {status}
          </p>
          {isVideo && connectedish && call.hasRemoteVideo && !call.remoteCameraOn && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-white/60">
              <VideoOff className="h-3.5 w-3.5" /> {firstName} turned their camera off
            </p>
          )}
        </div>
      )}

      {connectedish && call.remoteMuted && (
        <p className="relative z-10 mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[12px] text-white/85">
          <MicOff className="h-3.5 w-3.5" /> {firstName} is muted
        </p>
      )}

      {localPip && (
        <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+64px)] z-20 h-44 w-[104px] overflow-hidden rounded-2xl border border-white/25 bg-black shadow-xl">
          {call.cameraOn ? (
            <VideoView
              stream={calls.localStream}
              version={call.streams}
              mirrored={call.facing === 'user'}
              className="h-full w-full"
              label="Your camera"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/60">
              <VideoOff className="h-6 w-6" />
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      {call.phase === 'incoming' && (
        <div className="relative z-10 flex items-start justify-around px-10 pb-[calc(env(safe-area-inset-bottom)+44px)]">
          <div className="flex flex-col items-center gap-2">
            <RoundButton label="Decline" tone="end" size="lg" onClick={calls.decline}>
              <PhoneOff className="h-7 w-7" />
            </RoundButton>
            <span className="text-[13px] text-white/80">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <RoundButton label="Accept" tone="answer" size="lg" onClick={calls.accept}>
              {isVideo ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
            </RoundButton>
            <span className="text-[13px] text-white/80">Accept</span>
          </div>
        </div>
      )}

      {(call.phase === 'outgoing' || connectedish) && (
        <div className="relative z-10 mx-auto mb-[calc(env(safe-area-inset-bottom)+32px)] flex items-center gap-3 rounded-full bg-black/25 px-3 py-3 backdrop-blur">
          {isVideo ? (
            <>
              <RoundButton label="Switch camera" onClick={calls.switchCamera}>
                <SwitchCamera className="h-6 w-6" />
              </RoundButton>
              <RoundButton
                label={call.cameraOn ? 'Turn camera off' : 'Turn camera on'}
                pressed={!call.cameraOn}
                onClick={calls.toggleCamera}
              >
                {call.cameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </RoundButton>
            </>
          ) : (
            isAndroid && (
              <RoundButton label="Speaker" pressed={call.speaker} onClick={calls.toggleSpeaker}>
                <Volume2 className="h-6 w-6" />
              </RoundButton>
            )
          )}
          <RoundButton
            label={call.muted ? 'Unmute' : 'Mute'}
            pressed={call.muted}
            onClick={calls.toggleMute}
          >
            {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </RoundButton>
          <RoundButton label="End call" tone="end" onClick={calls.hangup}>
            <PhoneOff className="h-6 w-6" />
          </RoundButton>
        </div>
      )}

      {call.phase === 'ended' && <div className="pb-[calc(env(safe-area-inset-bottom)+120px)]" />}
    </div>
  );
}
