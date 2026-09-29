/**
 * The call model, shared by the engine, the signalling client and the screens.
 *
 * The wire shapes mirror `backend/app/routers/calls.py`: a call is set up by
 * signals the server relays between two people's phones, and remembered as a
 * record in both people's call lists.
 */

export type CallMedia = 'audio' | 'video';

export type SignalKind =
  | 'invite'
  | 'ringing'
  | 'accept'
  | 'decline'
  | 'busy'
  | 'cancel'
  | 'hangup'
  | 'offer'
  | 'answer'
  | 'ice'
  | 'state';

/** What the engine sends. The signalling client adds who and which device from. */
export interface OutgoingSignal {
  callId: string;
  kind: SignalKind;
  to: string;
  /** Once a call is answered, the one device on the other side it is between. */
  toDevice?: string;
  media?: CallMedia;
  roomId?: string;
  data?: Record<string, unknown>;
}

/** What arrives on the stream. */
export interface IncomingSignal extends OutgoingSignal {
  from: string;
  fromDevice: string;
}

export type CallOutcome = 'completed' | 'missed' | 'declined' | 'busy';

/** One line of the call list. Times are epoch milliseconds, as the server keeps them. */
export interface CallRecord {
  id: string;
  from: string;
  to: string;
  media: CallMedia;
  roomId: string | null;
  status: 'ringing' | 'active' | 'ended';
  outcome: CallOutcome | null;
  startedAt: number;
  answeredAt: number | null;
  endedAt: number | null;
}

/** Why a call on this phone ended, which is what its last screen says. */
export type EndReason =
  | 'ended'
  | 'no-answer'
  | 'declined'
  | 'busy'
  | 'unavailable'
  | 'failed'
  | 'cancelled'
  | 'missed'
  | 'media-denied'
  | 'elsewhere';

export type CallPhase = 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

/** The call on this phone, as the screens draw it. A new object on every change. */
export interface CallSnapshot {
  id: string;
  peerId: string;
  roomId: string | null;
  media: CallMedia;
  direction: 'outgoing' | 'incoming';
  phase: CallPhase;
  /** Outgoing: the other phone has said it is ringing. */
  ringing: boolean;
  /** Connected once, lost the path, and trying to get it back. */
  reconnecting: boolean;
  startedAt: number;
  connectedAt: number | null;
  endedAt: number | null;
  ended: EndReason | null;
  muted: boolean;
  cameraOn: boolean;
  facing: 'user' | 'environment';
  speaker: boolean;
  minimized: boolean;
  remoteMuted: boolean;
  remoteCameraOn: boolean;
  hasRemoteVideo: boolean;
  /** Bumped whenever a stream gains or loses a track, so video views re-bind. */
  streams: number;
}
