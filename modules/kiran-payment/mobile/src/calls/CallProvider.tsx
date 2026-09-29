/**
 * Calls, for the whole app.
 *
 * Holds the one call engine, keeps this phone listening for calls to whoever
 * is signed in, and does everything around a call that is not the call
 * itself: the ringtone and the ringback, vibrating, Android's speaker and
 * screen, the notification for a call that rings while the app is away, and
 * the call list with its missed-call count.
 *
 * Screens read it with `useCalls()`. Outside the provider — a screen rendered
 * on its own in a test — calls are simply switched off.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { App as NativeApp } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { useChat } from '@/lib/chat-store';
import { newId } from '@/lib/transport';
import { STANDALONE } from '~/local/config';
import { isNative } from '~/native/platform';
import { CallEngine } from '~/calls/engine';
import { callNative } from '~/calls/native';
import { DEVICE_ID, fetchHistory, openCallStream, sendSignal } from '~/calls/signaling';
import { tones } from '~/calls/tones';
import type { CallMedia, CallRecord, CallSnapshot } from '~/calls/types';

/**
 * A call needs the server to introduce the two phones. A standalone build has
 * no server, so it has no calls — and shows no call buttons.
 */
export const CALLS_ENABLED = !STANDALONE;

export interface CallsApi {
  enabled: boolean;
  /** Listening for calls: the stream to the server is open. */
  connected: boolean;
  call: CallSnapshot | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** This person's calls, newest first. */
  history: CallRecord[];
  historyFailed: boolean;
  /** Calls to this person that nobody answered, since the call list was last looked at. */
  missed: number;
  markSeen(): void;
  start(peerId: string, media: CallMedia, roomId?: string | null): void;
  accept(): void;
  decline(): void;
  hangup(): void;
  toggleMute(): void;
  toggleCamera(): void;
  switchCamera(): void;
  toggleSpeaker(): void;
  minimize(): void;
  restore(): void;
}

const noop = () => {};

const DISABLED: CallsApi = {
  enabled: false,
  connected: false,
  call: null,
  localStream: null,
  remoteStream: null,
  history: [],
  historyFailed: false,
  missed: 0,
  markSeen: noop,
  start: noop,
  accept: noop,
  decline: noop,
  hangup: noop,
  toggleMute: noop,
  toggleCamera: noop,
  switchCamera: noop,
  toggleSpeaker: noop,
  minimize: noop,
  restore: noop,
};

const CallsContext = createContext<CallsApi>(DISABLED);

export const useCalls = () => useContext(CallsContext);

function browserEngine(): CallEngine {
  return new CallEngine({
    device: DEVICE_ID,
    send: sendSignal,
    getUserMedia: (constraints) => {
      const devices = globalThis.navigator?.mediaDevices;
      if (!devices?.getUserMedia) {
        return Promise.reject(new Error('This device has no camera or microphone to call with.'));
      }
      return devices.getUserMedia(constraints);
    },
    createPeer: (config) => new RTCPeerConnection(config),
    createStream: () => new MediaStream(),
    newId: () => newId('call-'),
    now: () => Date.now(),
  });
}

/* ------------------------------------------------------ missed-call count */

const seenKey = (user: string) => `kiranos.calls.seen.${user}`;

function readSeen(user: string): number {
  try {
    return Number(localStorage.getItem(seenKey(user))) || 0;
  } catch {
    return 0;
  }
}

function writeSeen(user: string, at: number): void {
  try {
    localStorage.setItem(seenKey(user), String(at));
  } catch {
    /* The count comes back next launch; nothing else depends on it. */
  }
}

/** Rang and nobody picked up: what a call list shows in red. */
export function isMissed(record: CallRecord, user: string): boolean {
  return (
    record.to === user &&
    record.status === 'ended' &&
    (record.outcome === 'missed' || record.outcome === 'busy')
  );
}

function upsert(records: CallRecord[], record: CallRecord): CallRecord[] {
  const rest = records.filter((existing) => existing.id !== record.id);
  return [record, ...rest].sort((a, b) => b.startedAt - a.startedAt);
}

/* --------------------------------------------------- the app on screen */

/** Whether the app is on screen: what decides between a ringtone and a notification. */
function useAppActive(): boolean {
  const [active, setActive] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  useEffect(() => {
    const onVisibility = () => setActive(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    let cancelled = false;
    let remove: (() => void) | undefined;
    if (isNative) {
      void NativeApp.addListener('appStateChange', ({ isActive }) => setActive(isActive)).then(
        (handle) => {
          if (cancelled) void handle.remove();
          else remove = () => void handle.remove();
        },
      );
    }
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      remove?.();
    };
  }, []);
  return active;
}

function vibrate(ms: number): void {
  if (isNative) {
    void Haptics.vibrate({ duration: ms }).catch(() => undefined);
  } else {
    globalThis.navigator?.vibrate?.(ms);
  }
}

/* --------------------------------------------------------------- media */

/** The other person's voice. Lives here, not on the call screen, so it keeps playing when that is minimised. */
function RemoteAudio({ stream, version }: { stream: MediaStream | null; version: number }) {
  const element = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = element.current;
    if (!audio) return;
    if (audio.srcObject !== stream) audio.srcObject = stream;
    if (!stream) return;
    const playing = audio.play?.();
    if (playing && typeof playing.catch === 'function') playing.catch(() => undefined);
  }, [stream, version]);
  return <audio ref={element} autoPlay className="hidden" />;
}

/* ------------------------------------------------------------ provider */

export function CallProvider({ children }: { children: ReactNode }) {
  const { currentUserId, userById } = useChat();
  const engine = useMemo(browserEngine, []);
  const call = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [seenAt, setSeenAt] = useState(() => readSeen(currentUserId));
  const appActive = useAppActive();

  // Listen for calls to whoever is signed in. Switching person ends any call
  // and listens for the new one instead.
  useEffect(() => {
    if (!CALLS_ENABLED) return;
    engine.setIdentity(currentUserId);
    setHistory([]);
    setSeenAt(readSeen(currentUserId));
    let live = true;
    const load = () =>
      fetchHistory(currentUserId).then(
        (calls) => {
          if (!live) return;
          setHistory(calls);
          setHistoryFailed(false);
        },
        () => {
          if (live) setHistoryFailed(true);
        },
      );
    const close = openCallStream(currentUserId, {
      onReady: (servers) => {
        engine.setIceServers(servers);
        void load();
      },
      onSignal: (signal) => engine.handleSignal(signal),
      onRecord: (record) => {
        if (live) setHistory((current) => upsert(current, record));
      },
      onStatus: (next) => {
        if (live) setConnected(next);
      },
    });
    return () => {
      live = false;
      close();
      engine.leave();
      setConnected(false);
    };
  }, [engine, currentUserId]);

  const phase = call?.phase ?? null;
  const peerName = call ? userById(call.peerId).name : '';
  const video = call?.media === 'video';

  // An incoming call rings on screen, or from the notification shade when the
  // app is away. Coming back to the app moves it from one to the other.
  useEffect(() => {
    if (phase !== 'incoming') return;
    if (appActive) {
      tones.ringtone.start();
      vibrate(900);
      const buzz = setInterval(() => vibrate(900), 2_400);
      return () => {
        tones.ringtone.stop();
        clearInterval(buzz);
      };
    }
    callNative.showIncoming(peerName, video ? 'Incoming video call' : 'Incoming voice call');
    return () => callNative.clearIncoming();
  }, [phase, appActive, peerName, video]);

  // Ringback once the other phone says it is ringing, as a phone line does.
  const ringingOut = phase === 'outgoing' && Boolean(call?.ringing);
  useEffect(() => {
    if (!ringingOut) return;
    tones.ringback.start();
    return () => tones.ringback.stop();
  }, [ringingOut]);

  // The sound of the line going dead, or engaged.
  const ended = phase === 'ended' ? call?.ended : null;
  const outgoing = call?.direction === 'outgoing';
  useEffect(() => {
    if (!ended) return;
    if (ended === 'busy' || (ended === 'declined' && outgoing)) tones.busy();
    else if (ended !== 'missed' && ended !== 'elsewhere' && ended !== 'declined') tones.ended();
    // Asked after a call rather than at launch: by then it is obvious why.
    callNative.askForNotifications();
  }, [ended, outgoing]);

  // Android: the screen, the speaker, and the microphone in the background.
  const live = phase === 'outgoing' || phase === 'connecting' || phase === 'active';
  const speaker = Boolean(call?.speaker);
  const proximity = live && !video && !speaker;
  useEffect(() => {
    callNative.inCall(live, proximity);
  }, [live, proximity]);
  useEffect(() => {
    // Chromium picks its own output when the microphone opens, so this is
    // applied again at each step of the call as well as on every toggle.
    if (live) callNative.speaker(speaker);
  }, [live, speaker, phase]);
  const holdingMedia = live && (call?.streams ?? 0) > 0;
  useEffect(() => {
    if (!holdingMedia) return;
    callNative.startOngoing(peerName, video);
    return () => callNative.stopOngoing();
  }, [holdingMedia, peerName, video]);

  const markSeen = useCallback(() => {
    const now = Date.now();
    setSeenAt(now);
    writeSeen(currentUserId, now);
  }, [currentUserId]);

  const missed = useMemo(
    () =>
      history.filter((record) => isMissed(record, currentUserId) && record.startedAt > seenAt)
        .length,
    [history, currentUserId, seenAt],
  );

  const start = useCallback(
    (peerId: string, media: CallMedia, roomId: string | null = null) => {
      engine.start(peerId, media, roomId).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'The call could not be started.');
      });
    },
    [engine],
  );

  const api = useMemo<CallsApi>(
    () => ({
      enabled: CALLS_ENABLED,
      connected,
      call,
      localStream: engine.localStream,
      remoteStream: engine.remoteStream,
      history,
      historyFailed,
      missed,
      markSeen,
      start,
      accept: () => void engine.accept(),
      decline: () => engine.decline(),
      hangup: () => engine.hangup(),
      toggleMute: () => engine.toggleMute(),
      toggleCamera: () => engine.toggleCamera(),
      switchCamera: () => void engine.switchCamera(),
      toggleSpeaker: () => engine.setSpeaker(!engine.getSnapshot()?.speaker),
      minimize: () => engine.setMinimized(true),
      restore: () => engine.setMinimized(false),
    }),
    [engine, connected, call, history, historyFailed, missed, markSeen, start],
  );

  if (!CALLS_ENABLED) return <>{children}</>;

  return (
    <CallsContext.Provider value={api}>
      {children}
      {call && <RemoteAudio stream={engine.remoteStream} version={call.streams} />}
    </CallsContext.Provider>
  );
}
