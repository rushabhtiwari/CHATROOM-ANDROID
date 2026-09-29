/**
 * One phone's side of a call.
 *
 * A plain class rather than a hook. A call outlives the screens it appears on
 * (it carries on while you read a chat), it is driven as much by signals
 * arriving from the server as by taps, and nearly every step is asynchronous —
 * so after each await the engine checks that the call it started for is still
 * the call in progress. React reads it through `subscribe`/`getSnapshot`.
 *
 * The media never touches the server. The engine asks the server to relay an
 * invitation; once the other side accepts, the two phones swap session
 * descriptions and network candidates through the same relay, and WebRTC
 * connects them directly.
 */
import type {
  CallMedia,
  CallSnapshot,
  EndReason,
  IncomingSignal,
  OutgoingSignal,
} from '~/calls/types';

/** How long an outgoing call rings before it counts as unanswered. */
export const RING_MS = 45_000;
/** An incoming call that nobody cancels stops ringing on its own after this. */
export const INCOMING_MS = 55_000;
/** Answered, but no way through to the other phone within this long: failed. */
export const CONNECT_MS = 30_000;
/** A connected call that lost its path gets this long to find it again. */
export const RECONNECT_MS = 12_000;
/** A connected call checks in this often; the server ends silent calls (calls.py). */
export const KEEPALIVE_MS = 30_000;
/** How long the last screen of a call — "Call ended" — stays up. */
export const LINGER_MS = 1_800;

/** A signal the server did not take. `status` is null when it was never reached. */
export class SignalError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'SignalError';
  }
}

export interface CallDeps {
  /** This app session, as the server tells one of a person's phones from another. */
  device: string;
  send(signal: IncomingSignal): Promise<{ delivered: number }>;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createPeer(config: RTCConfiguration): RTCPeerConnection;
  createStream(): MediaStream;
  newId(): string;
  now(): number;
}

export const DEFAULT_ICE: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

type Facing = CallSnapshot['facing'];

/** Enough for a face on a phone screen, and light enough for a weak link. */
function videoConstraints(facing: Facing): MediaTrackConstraints {
  return {
    facingMode: facing,
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 24, max: 30 },
  };
}

export function mediaConstraints(
  media: CallMedia,
  facing: Facing = 'user',
): MediaStreamConstraints {
  return {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: media === 'video' ? videoConstraints(facing) : false,
  };
}

function stopTracks(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

/** Endings that need no last screen: nothing happened that the person has to be told. */
const QUIET: ReadonlySet<EndReason> = new Set(['missed', 'elsewhere']);

type Timer = ReturnType<typeof setTimeout>;

export class CallEngine {
  private call: CallSnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  private user: string | null = null;
  private iceServers: RTCIceServer[] = DEFAULT_ICE;
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private remote: MediaStream | null = null;
  /** The one device on the other side this call is with, once that is known. */
  private peerDevice: string | null = null;
  /** Candidates that arrived before the description they belong to. */
  private pendingIce: RTCIceCandidateInit[] = [];
  private described = false;
  private invited = false;
  /** Calls this phone has already seen, so an invitation delivered twice rings once. */
  private readonly seen: string[] = [];
  private readonly timers = new Map<string, Timer>();
  private keepalive: ReturnType<typeof setInterval> | null = null;
  /** Signals leave in the order they were made: an offer before its candidates. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: CallDeps) {}

  /* ------------------------------------------------------------ reading */

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): CallSnapshot | null => this.call;

  get localStream(): MediaStream | null {
    return this.local;
  }

  get remoteStream(): MediaStream | null {
    return this.remote;
  }

  /** On a call, or ringing, or being rung. */
  get busy(): boolean {
    return this.call !== null && this.call.phase !== 'ended';
  }

  /* ------------------------------------------------------ configuration */

  /** Who is signed in. A call belongs to the person, so a switch ends it. */
  setIdentity(user: string | null): void {
    if (user === this.user) return;
    if (this.busy) this.hangup();
    this.user = user;
  }

  setIceServers(servers: RTCIceServer[]): void {
    if (servers.length > 0) this.iceServers = servers;
  }

  /** The stream closed: this phone can no longer be reached, so any call ends. */
  leave(): void {
    if (this.busy) this.hangup();
  }

  /* ------------------------------------------------------------ actions */

  async start(peerId: string, media: CallMedia, roomId: string | null = null): Promise<void> {
    if (!this.user) throw new Error('Choose who you are on the Me tab first.');
    if (peerId === this.user) throw new Error('You cannot call yourself.');
    if (this.busy) throw new Error('You are already on a call.');

    this.reset();
    const id = this.deps.newId();
    this.remember(id);
    this.call = {
      id,
      peerId,
      roomId,
      media,
      direction: 'outgoing',
      phase: 'outgoing',
      ringing: false,
      reconnecting: false,
      startedAt: this.deps.now(),
      connectedAt: null,
      endedAt: null,
      ended: null,
      muted: false,
      cameraOn: media === 'video',
      facing: 'user',
      // A video call is held at arm's length; a voice call against the ear.
      speaker: media === 'video',
      minimized: false,
      remoteMuted: false,
      remoteCameraOn: media === 'video',
      hasRemoteVideo: false,
      streams: 0,
    };
    this.emit();

    // The microphone (and camera) first: asking for them can take a
    // permission prompt, and the other phone should not ring before this one
    // is able to talk.
    let local: MediaStream;
    try {
      local = await this.deps.getUserMedia(mediaConstraints(media));
    } catch {
      if (this.isCurrent(id)) this.finish('media-denied');
      return;
    }
    if (!this.isCurrent(id) || this.call?.phase !== 'outgoing') {
      stopTracks(local);
      return;
    }
    this.local = local;
    this.bump();

    this.invited = true;
    try {
      await this.post({
        callId: id,
        kind: 'invite',
        to: peerId,
        media,
        ...(roomId ? { roomId } : {}),
      });
    } catch {
      if (this.isCurrent(id) && this.call?.phase === 'outgoing') this.finish('unavailable');
      return;
    }
    if (!this.isCurrent(id)) return;
    this.after('ring', RING_MS, () => {
      if (!this.isCurrent(id) || this.call?.phase !== 'outgoing') return;
      this.tell({ callId: id, kind: 'cancel', to: peerId, data: { reason: 'timeout' } });
      this.finish('no-answer');
    });
  }

  async accept(): Promise<void> {
    const call = this.call;
    if (!call || call.phase !== 'incoming') return;
    const id = call.id;
    this.clear('incoming');
    this.patch({ phase: 'connecting', minimized: false });

    let local: MediaStream;
    try {
      local = await this.deps.getUserMedia(mediaConstraints(call.media));
    } catch {
      if (this.isCurrent(id)) {
        this.tell({ callId: id, kind: 'decline', to: call.peerId, ...this.toPeer() });
        this.finish('media-denied');
      }
      return;
    }
    if (!this.isCurrent(id) || this.call?.phase !== 'connecting') {
      stopTracks(local);
      return;
    }
    this.local = local;
    this.openPeer(id);
    this.bump();

    try {
      await this.post({ callId: id, kind: 'accept', to: call.peerId, ...this.toPeer() });
    } catch (error) {
      if (!this.isCurrent(id)) return;
      const status = error instanceof SignalError ? error.status : null;
      // 409: another of this person's phones answered first. 404/410: the
      // caller gave up in the same moment.
      this.finish(status === 409 ? 'elsewhere' : status === null ? 'unavailable' : 'cancelled');
      return;
    }
    if (this.isCurrent(id) && this.call?.phase === 'connecting') {
      this.after('connect', CONNECT_MS, () => this.fail(id));
    }
  }

  decline(): void {
    const call = this.call;
    if (!call || call.phase !== 'incoming') return;
    this.tell({ callId: call.id, kind: 'decline', to: call.peerId, ...this.toPeer() });
    this.finish('declined', 0);
  }

  hangup(): void {
    const call = this.call;
    if (!call || call.phase === 'ended') return;
    if (call.phase === 'incoming') {
      this.decline();
      return;
    }
    if (call.phase === 'outgoing') {
      // Nothing to cancel if the invitation never left this phone.
      if (this.invited) {
        this.tell({
          callId: call.id,
          kind: 'cancel',
          to: call.peerId,
          data: { reason: 'cancelled' },
        });
      }
      this.finish('cancelled');
      return;
    }
    this.tell({ callId: call.id, kind: 'hangup', to: call.peerId, ...this.toPeer() });
    this.finish('ended');
  }

  toggleMute(): void {
    const call = this.call;
    if (!call || call.phase === 'ended') return;
    const muted = !call.muted;
    for (const track of this.local?.getAudioTracks() ?? []) track.enabled = !muted;
    this.patch({ muted });
    this.shareState();
  }

  toggleCamera(): void {
    const call = this.call;
    if (!call || call.media !== 'video' || call.phase === 'ended') return;
    const cameraOn = !call.cameraOn;
    for (const track of this.local?.getVideoTracks() ?? []) track.enabled = cameraOn;
    this.patch({ cameraOn });
    this.shareState();
  }

  /** Front camera to back, or back. */
  async switchCamera(): Promise<void> {
    const call = this.call;
    const local = this.local;
    if (!call || call.media !== 'video' || !local || call.phase === 'ended') return;
    const id = call.id;
    const old = local.getVideoTracks()[0];
    // Many phones cannot open both cameras at once: let go of this one first.
    old?.stop();

    const open = async (facing: Facing) =>
      (
        await this.deps.getUserMedia({ audio: false, video: videoConstraints(facing) })
      ).getVideoTracks()[0];
    let facing: Facing = call.facing === 'user' ? 'environment' : 'user';
    let track: MediaStreamTrack | undefined;
    try {
      track = await open(facing);
    } catch {
      // No other camera, or it would not open: back to the one we had.
      facing = call.facing;
      track = await open(facing).catch(() => undefined);
    }
    if (!track) return;
    const current = this.call;
    if (!this.isCurrent(id) || this.local !== local || !current || current.phase === 'ended') {
      track.stop();
      return;
    }
    track.enabled = current.cameraOn;
    if (old) local.removeTrack(old);
    local.addTrack(track);
    const sender = this.pc?.getSenders().find((candidate) => candidate.track?.kind === 'video');
    try {
      await sender?.replaceTrack(track);
    } catch {
      /* The preview switched; the other phone keeps the last frame it had. */
    }
    this.patch({ facing, streams: current.streams + 1 });
  }

  setSpeaker(speaker: boolean): void {
    if (this.busy) this.patch({ speaker });
  }

  setMinimized(minimized: boolean): void {
    if (this.call && this.call.minimized !== minimized) this.patch({ minimized });
  }

  /* ------------------------------------------------------------ signals */

  handleSignal(signal: IncomingSignal): void {
    // Meant for whoever was signed in on this phone before.
    if (!this.user || signal.to !== this.user) return;
    if (signal.kind === 'invite') {
      this.onInvite(signal);
      return;
    }
    const call = this.call;
    if (!call || call.id !== signal.callId || call.phase === 'ended') return;
    // Once answered, only the device that answered speaks for the other side
    // (and the server, which stops ringing that gave up).
    if (
      this.peerDevice &&
      signal.fromDevice !== this.peerDevice &&
      signal.fromDevice !== 'server'
    ) {
      return;
    }

    switch (signal.kind) {
      case 'ringing':
        if (call.phase === 'outgoing' && !call.ringing) this.patch({ ringing: true });
        break;
      case 'accept':
        void this.onAccepted(signal);
        break;
      case 'decline':
        if (call.phase === 'outgoing') this.finish('declined');
        break;
      case 'busy':
        if (call.phase === 'outgoing') this.finish('busy');
        break;
      case 'cancel':
        this.onCancelled(signal);
        break;
      case 'hangup':
        this.finish('ended');
        break;
      case 'offer':
        void this.onOffer(signal);
        break;
      case 'answer':
        void this.onAnswer(signal);
        break;
      case 'ice':
        void this.onIce(signal);
        break;
      case 'state':
        this.onState(signal);
        break;
    }
  }

  private onInvite(signal: IncomingSignal): void {
    if (this.seen.includes(signal.callId)) return;
    this.remember(signal.callId);
    if (this.busy) {
      // One call at a time: the caller hears that this line is engaged.
      this.tell({
        callId: signal.callId,
        kind: 'busy',
        to: signal.from,
        toDevice: signal.fromDevice,
      });
      return;
    }
    this.reset();
    const media: CallMedia = signal.media === 'video' ? 'video' : 'audio';
    this.peerDevice = signal.fromDevice;
    this.call = {
      id: signal.callId,
      peerId: signal.from,
      roomId: signal.roomId ?? null,
      media,
      direction: 'incoming',
      phase: 'incoming',
      ringing: false,
      reconnecting: false,
      startedAt: this.deps.now(),
      connectedAt: null,
      endedAt: null,
      ended: null,
      muted: false,
      cameraOn: media === 'video',
      facing: 'user',
      speaker: media === 'video',
      minimized: false,
      remoteMuted: false,
      remoteCameraOn: media === 'video',
      hasRemoteVideo: false,
      streams: 0,
    };
    this.emit();
    this.tell({ callId: signal.callId, kind: 'ringing', to: signal.from, ...this.toPeer() });
    const id = signal.callId;
    this.after('incoming', INCOMING_MS, () => {
      if (this.isCurrent(id) && this.call?.phase === 'incoming') this.finish('missed');
    });
  }

  private async onAccepted(signal: IncomingSignal): Promise<void> {
    const call = this.call;
    if (!call || call.direction !== 'outgoing' || call.phase !== 'outgoing') return;
    const id = call.id;
    this.clear('ring');
    this.peerDevice = signal.fromDevice;
    this.patch({ phase: 'connecting', ringing: false });
    this.openPeer(id);
    const pc = this.pc;
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      if (!this.isCurrent(id) || this.pc !== pc) return;
      await pc.setLocalDescription(offer);
      if (!this.isCurrent(id) || this.pc !== pc) return;
      await this.post({
        callId: id,
        kind: 'offer',
        to: call.peerId,
        ...this.toPeer(),
        data: { sdp: offer.sdp },
      });
    } catch {
      this.fail(id);
      return;
    }
    if (this.isCurrent(id) && this.call?.phase === 'connecting') {
      this.after('connect', CONNECT_MS, () => this.fail(id));
    }
  }

  /** The caller's description — first, or again after its network changed. */
  private async onOffer(signal: IncomingSignal): Promise<void> {
    const call = this.call;
    const pc = this.pc;
    const sdp = typeof signal.data?.sdp === 'string' ? signal.data.sdp : null;
    if (!call || !pc || !sdp) return;
    const id = call.id;
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      this.described = true;
      await this.flushIce(pc);
      const answer = await pc.createAnswer();
      if (!this.isCurrent(id) || this.pc !== pc) return;
      await pc.setLocalDescription(answer);
      this.tell({
        callId: id,
        kind: 'answer',
        to: call.peerId,
        ...this.toPeer(),
        data: { sdp: answer.sdp },
      });
    } catch {
      this.fail(id);
    }
  }

  private async onAnswer(signal: IncomingSignal): Promise<void> {
    const call = this.call;
    const pc = this.pc;
    const sdp = typeof signal.data?.sdp === 'string' ? signal.data.sdp : null;
    // An answer to an offer this phone is no longer waiting on is stale.
    if (!call || !pc || !sdp || pc.signalingState !== 'have-local-offer') return;
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp });
      this.described = true;
      await this.flushIce(pc);
    } catch {
      this.fail(call.id);
    }
  }

  private async onIce(signal: IncomingSignal): Promise<void> {
    const candidate = signal.data?.candidate as RTCIceCandidateInit | undefined;
    if (!candidate) return;
    if (!this.pc || !this.described) {
      this.pendingIce.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      /* A candidate for a path already abandoned. */
    }
  }

  private async flushIce(pc: RTCPeerConnection): Promise<void> {
    const pending = this.pendingIce;
    this.pendingIce = [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* As above. */
      }
    }
  }

  private onCancelled(signal: IncomingSignal): void {
    const call = this.call;
    if (!call) return;
    const reason = signal.data?.reason;
    if (reason === 'answered_elsewhere' || reason === 'declined_elsewhere') {
      this.finish('elsewhere');
      return;
    }
    if (call.direction === 'incoming') {
      this.finish(call.phase === 'incoming' ? 'missed' : 'ended');
    } else if (call.phase === 'outgoing') {
      // Toward a caller only the server cancels: the call rang out.
      this.finish('no-answer');
    }
  }

  private onState(signal: IncomingSignal): void {
    const call = this.call;
    if (!call) return;
    const data = signal.data ?? {};
    const remoteMuted = typeof data.muted === 'boolean' ? data.muted : call.remoteMuted;
    const remoteCameraOn = typeof data.cameraOn === 'boolean' ? data.cameraOn : call.remoteCameraOn;
    if (remoteMuted !== call.remoteMuted || remoteCameraOn !== call.remoteCameraOn) {
      this.patch({ remoteMuted, remoteCameraOn });
    }
  }

  /* --------------------------------------------------------- the media */

  private openPeer(id: string): void {
    const pc = this.deps.createPeer({ iceServers: this.iceServers });
    this.pc = pc;
    this.described = false;
    const local = this.local;
    for (const track of local?.getTracks() ?? []) pc.addTrack(track, local!);

    pc.onicecandidate = (event) => {
      const call = this.call;
      if (!event.candidate || !call || call.id !== id || this.pc !== pc) return;
      this.tell({
        callId: id,
        kind: 'ice',
        to: call.peerId,
        ...this.toPeer(),
        data: { candidate: event.candidate.toJSON() },
      });
    };
    pc.ontrack = (event) => {
      const call = this.call;
      if (!call || call.id !== id || this.pc !== pc) return;
      this.remote ??= this.deps.createStream();
      if (!this.remote.getTracks().includes(event.track)) this.remote.addTrack(event.track);
      this.patch({
        streams: call.streams + 1,
        hasRemoteVideo: call.hasRemoteVideo || event.track.kind === 'video',
      });
    };
    const onChange = () => this.onConnection(id, pc);
    pc.onconnectionstatechange = onChange;
    pc.oniceconnectionstatechange = onChange;
  }

  private onConnection(id: string, pc: RTCPeerConnection): void {
    const call = this.call;
    if (!call || call.id !== id || this.pc !== pc || call.phase === 'ended') return;
    const state = connectionOf(pc);

    if (state === 'connected') {
      this.clear('connect');
      this.clear('reconnect');
      if (call.phase === 'connecting') {
        this.patch({ phase: 'active', connectedAt: this.deps.now(), reconnecting: false });
        // The other phone learns where this one stands, and the server that
        // the call is still going.
        this.shareState();
        this.keepalive = setInterval(() => this.shareState(), KEEPALIVE_MS);
      } else if (call.reconnecting) {
        this.patch({ reconnecting: false });
      }
      return;
    }

    if (state === 'disconnected' || state === 'failed') {
      if (call.phase !== 'active') {
        if (state === 'failed') this.fail(id);
        return;
      }
      if (!call.reconnecting) this.patch({ reconnecting: true });
      // The caller leads a restart; the other phone answers the new offer.
      if (state === 'failed' && call.direction === 'outgoing') void this.restartIce(id, pc);
      if (!this.timers.has('reconnect')) this.after('reconnect', RECONNECT_MS, () => this.fail(id));
    }
  }

  private async restartIce(id: string, pc: RTCPeerConnection): Promise<void> {
    const call = this.call;
    if (!call) return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      if (!this.isCurrent(id) || this.pc !== pc) return;
      await pc.setLocalDescription(offer);
      this.tell({
        callId: id,
        kind: 'offer',
        to: call.peerId,
        ...this.toPeer(),
        data: { sdp: offer.sdp },
      });
    } catch {
      /* The reconnect timer ends the call. */
    }
  }

  /** No way through: tell the other side, and end it here. */
  private fail(id: string): void {
    const call = this.call;
    if (!call || call.id !== id || call.phase === 'ended') return;
    this.tell({
      callId: id,
      kind: 'hangup',
      to: call.peerId,
      ...this.toPeer(),
      data: { reason: 'failed' },
    });
    this.finish('failed');
  }

  private shareState(): void {
    const call = this.call;
    if (!call || !this.peerDevice) return;
    if (call.phase !== 'connecting' && call.phase !== 'active') return;
    this.tell({
      callId: call.id,
      kind: 'state',
      to: call.peerId,
      toDevice: this.peerDevice,
      data: { muted: call.muted, cameraOn: call.cameraOn },
    });
  }

  /* ------------------------------------------------------------ plumbing */

  private finish(reason: EndReason, linger = QUIET.has(reason) ? 0 : LINGER_MS): void {
    const call = this.call;
    if (!call || call.phase === 'ended') return;
    this.teardown();
    this.call = {
      ...call,
      phase: 'ended',
      ended: reason,
      endedAt: this.deps.now(),
      ringing: false,
      reconnecting: false,
    };
    this.emit();
    const id = call.id;
    this.after('close', linger, () => {
      if (this.call?.id === id && this.call.phase === 'ended') {
        this.call = null;
        this.emit();
      }
    });
  }

  private teardown(): void {
    for (const key of ['ring', 'incoming', 'connect', 'reconnect']) this.clear(key);
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
    stopTracks(this.local);
    this.local = null;
    const pc = this.pc;
    this.pc = null;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        /* Already closed. */
      }
    }
    this.remote = null;
    this.pendingIce = [];
    this.described = false;
    this.invited = false;
  }

  /** Clear away the last call, ended or not, before a new one. */
  private reset(): void {
    this.clear('close');
    this.teardown();
    this.peerDevice = null;
    this.call = null;
  }

  private toPeer(): { toDevice?: string } {
    return this.peerDevice ? { toDevice: this.peerDevice } : {};
  }

  private post(signal: OutgoingSignal): Promise<{ delivered: number }> {
    const from = this.user;
    if (!from) return Promise.reject(new SignalError('Nobody is signed in.', null));
    const run = () => this.deps.send({ ...signal, from, fromDevice: this.deps.device });
    const sent = this.chain.then(run, run);
    this.chain = sent.catch(() => undefined);
    return sent;
  }

  /** For signals whose failure changes nothing on this phone. */
  private tell(signal: OutgoingSignal): void {
    void this.post(signal).catch(() => undefined);
  }

  private isCurrent(id: string): boolean {
    return this.call?.id === id;
  }

  private bump(): void {
    if (this.call) this.patch({ streams: this.call.streams + 1 });
  }

  private patch(changes: Partial<CallSnapshot>): void {
    if (!this.call) return;
    this.call = { ...this.call, ...changes };
    this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  private after(key: string, ms: number, run: () => void): void {
    this.clear(key);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        run();
      }, ms),
    );
  }

  private clear(key: string): void {
    const timer = this.timers.get(key);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.timers.delete(key);
  }

  private remember(id: string): void {
    this.seen.push(id);
    if (this.seen.length > 50) this.seen.shift();
  }
}

/** The peer connection's overall state, from whichever property this web view has. */
function connectionOf(pc: RTCPeerConnection): RTCPeerConnectionState {
  if (pc.connectionState) return pc.connectionState;
  switch (pc.iceConnectionState) {
    case 'connected':
    case 'completed':
      return 'connected';
    case 'checking':
      return 'connecting';
    case 'disconnected':
      return 'disconnected';
    case 'failed':
      return 'failed';
    case 'closed':
      return 'closed';
    default:
      return 'new';
  }
}
