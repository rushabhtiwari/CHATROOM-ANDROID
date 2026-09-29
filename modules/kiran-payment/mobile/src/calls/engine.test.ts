import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallEngine, LINGER_MS, RECONNECT_MS, RING_MS, SignalError } from '~/calls/engine';
import type { IncomingSignal } from '~/calls/types';

/*
 * The engine runs against stand-ins for the three things jsdom does not have:
 * the camera and microphone, the peer connection and the server. Each stand-in
 * records what the engine did to it, so a test reads like the call it drives.
 */

class FakeTrack {
  enabled = true;
  stopped = false;
  constructor(readonly kind: 'audio' | 'video') {}
  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  constructor(private tracks: FakeTrack[] = []) {}
  getTracks() {
    return [...this.tracks];
  }
  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio');
  }
  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video');
  }
  addTrack(track: FakeTrack) {
    this.tracks.push(track);
  }
  removeTrack(track: FakeTrack) {
    this.tracks = this.tracks.filter((existing) => existing !== track);
  }
}

class FakePeer {
  static all: FakePeer[] = [];
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: ((event: { track: FakeTrack }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  added: FakeTrack[] = [];
  remote: RTCSessionDescriptionInit[] = [];
  candidates: RTCIceCandidateInit[] = [];
  senders: Array<{ track: FakeTrack | null; replaceTrack: (track: FakeTrack) => Promise<void> }> =
    [];
  closed = false;

  constructor(readonly config: RTCConfiguration) {
    FakePeer.all.push(this);
  }
  addTrack(track: FakeTrack) {
    this.added.push(track);
    const sender = {
      track: track as FakeTrack | null,
      replaceTrack: async (next: FakeTrack) => {
        sender.track = next;
      },
    };
    this.senders.push(sender);
    return sender;
  }
  getSenders() {
    return this.senders;
  }
  async createOffer(options?: RTCOfferOptions) {
    return { type: 'offer' as const, sdp: options?.iceRestart ? 'offer-restart' : 'offer-first' };
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: 'answer-sdp' };
  }
  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remote.push(description);
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    this.candidates.push(candidate);
  }
  close() {
    this.closed = true;
  }
  /* Test controls. */
  becomes(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
  gathers(candidate: RTCIceCandidateInit) {
    this.onicecandidate?.({ candidate: { toJSON: () => candidate } });
  }
  receives(kind: 'audio' | 'video') {
    this.ontrack?.({ track: new FakeTrack(kind) });
  }
}

let serial = 0;

function harness(user: string) {
  const sent: IncomingSignal[] = [];
  const refuse: { when: ((signal: IncomingSignal) => SignalError | null) | null } = { when: null };
  const opened: FakeStream[] = [];
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    const stream = new FakeStream([
      ...(constraints.audio ? [new FakeTrack('audio')] : []),
      ...(constraints.video ? [new FakeTrack('video')] : []),
    ]);
    opened.push(stream);
    return stream as unknown as MediaStream;
  });
  const engine = new CallEngine({
    device: `${user}-phone`,
    send: vi.fn(async (signal: IncomingSignal) => {
      const refusal = refuse.when?.(signal);
      if (refusal) throw refusal;
      sent.push(signal);
      return { delivered: 1 };
    }),
    getUserMedia,
    createPeer: (config) => new FakePeer(config) as unknown as RTCPeerConnection,
    createStream: () => new FakeStream() as unknown as MediaStream,
    newId: () => `call-${++serial}`,
    now: () => Date.now(),
  });
  engine.setIdentity(user);
  const kinds = () => sent.map((signal) => signal.kind);
  const now = () => engine.getSnapshot();
  const peer = () => FakePeer.all[FakePeer.all.length - 1]!;
  return { engine, sent, kinds, now, peer, getUserMedia, opened, refuse };
}

/** A signal from the other side of the call. */
function from(
  who: string,
  device: string,
  to: string,
  callId: string,
  kind: IncomingSignal['kind'],
  extra: Partial<IncomingSignal> = {},
): IncomingSignal {
  return { callId, kind, from: who, fromDevice: device, to, ...extra };
}

/** Let every pending promise and zero-delay timer run. */
const settle = () => vi.advanceTimersByTimeAsync(1);

beforeEach(() => {
  vi.useFakeTimers();
  FakePeer.all = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('placing a call', () => {
  it('invites, hears it ring, connects when answered, and hangs up', async () => {
    const { engine, sent, kinds, now, peer, opened } = harness('u1');
    void engine.start('u2', 'audio', 'd1');
    await settle();

    expect(now()).toMatchObject({
      phase: 'outgoing',
      ringing: false,
      media: 'audio',
      speaker: false,
    });
    expect(sent).toEqual([
      expect.objectContaining({
        kind: 'invite',
        from: 'u1',
        fromDevice: 'u1-phone',
        to: 'u2',
        media: 'audio',
        roomId: 'd1',
      }),
    ]);
    const id = sent[0]!.callId;

    engine.handleSignal(from('u2', 'u2-phone', 'u1', id, 'ringing'));
    expect(now()?.ringing).toBe(true);

    engine.handleSignal(from('u2', 'u2-phone', 'u1', id, 'accept'));
    await settle();
    expect(now()?.phase).toBe('connecting');
    expect(sent.at(-1)).toMatchObject({
      kind: 'offer',
      toDevice: 'u2-phone',
      data: { sdp: 'offer-first' },
    });
    expect(peer().added.map((track) => track.kind)).toEqual(['audio']);

    // A candidate that overtakes the answer waits for it.
    engine.handleSignal(
      from('u2', 'u2-phone', 'u1', id, 'ice', { data: { candidate: { candidate: 'theirs' } } }),
    );
    await settle();
    expect(peer().candidates).toEqual([]);
    engine.handleSignal(
      from('u2', 'u2-phone', 'u1', id, 'answer', { data: { sdp: 'answer-sdp' } }),
    );
    await settle();
    expect(peer().remote).toEqual([{ type: 'answer', sdp: 'answer-sdp' }]);
    expect(peer().candidates).toEqual([{ candidate: 'theirs' }]);

    peer().gathers({ candidate: 'mine' });
    await settle();
    expect(sent.at(-1)).toMatchObject({
      kind: 'ice',
      toDevice: 'u2-phone',
      data: { candidate: { candidate: 'mine' } },
    });

    peer().becomes('connected');
    await settle();
    expect(now()).toMatchObject({ phase: 'active' });
    expect(now()?.connectedAt).not.toBeNull();
    // The other phone learns this one's microphone and camera state.
    expect(kinds()).toContain('state');

    engine.hangup();
    await settle();
    expect(sent.at(-1)).toMatchObject({ kind: 'hangup', toDevice: 'u2-phone' });
    expect(now()).toMatchObject({ phase: 'ended', ended: 'ended' });
    expect(peer().closed).toBe(true);
    expect(opened[0]!.getTracks().every((track) => (track as FakeTrack).stopped)).toBe(true);

    await vi.advanceTimersByTimeAsync(LINGER_MS);
    expect(now()).toBeNull();
  });

  it('gives up when nobody answers', async () => {
    const { engine, sent, now } = harness('u1');
    void engine.start('u2', 'video');
    await settle();
    await vi.advanceTimersByTimeAsync(RING_MS);
    expect(sent.at(-1)).toMatchObject({ kind: 'cancel', data: { reason: 'timeout' } });
    expect(now()).toMatchObject({ phase: 'ended', ended: 'no-answer' });
  });

  it('says so when the other side declines, or is on another call', async () => {
    const first = harness('u1');
    void first.engine.start('u2', 'audio');
    await settle();
    first.engine.handleSignal(from('u2', 'u2-phone', 'u1', first.sent[0]!.callId, 'decline'));
    expect(first.now()).toMatchObject({ phase: 'ended', ended: 'declined' });

    const second = harness('u1');
    void second.engine.start('u2', 'audio');
    await settle();
    second.engine.handleSignal(from('u2', 'u2-phone', 'u1', second.sent[0]!.callId, 'busy'));
    expect(second.now()).toMatchObject({ phase: 'ended', ended: 'busy' });
  });

  it('sends nothing when the call is abandoned before the invitation leaves', async () => {
    const { engine, sent, now, getUserMedia } = harness('u1');
    // The microphone prompt is still up.
    getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>(() => {}));
    void engine.start('u2', 'audio');
    await settle();
    engine.hangup();
    await settle();
    expect(sent).toEqual([]);
    expect(now()).toMatchObject({ phase: 'ended', ended: 'cancelled' });
  });

  it('asks for nothing and rings nobody without a microphone', async () => {
    const { engine, sent, now, getUserMedia } = harness('u1');
    getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    void engine.start('u2', 'audio');
    await settle();
    expect(sent).toEqual([]);
    expect(now()).toMatchObject({ phase: 'ended', ended: 'media-denied' });
  });

  it('ends at once when the call server cannot be reached', async () => {
    const { engine, now, refuse } = harness('u1');
    refuse.when = () => new SignalError('Could not reach the call server.', null);
    void engine.start('u2', 'audio');
    await settle();
    expect(now()).toMatchObject({ phase: 'ended', ended: 'unavailable' });
  });

  it('refuses a second call, and calling yourself', async () => {
    const { engine } = harness('u1');
    await expect(engine.start('u1', 'audio')).rejects.toThrow('You cannot call yourself.');
    void engine.start('u2', 'audio');
    await settle();
    await expect(engine.start('u3', 'audio')).rejects.toThrow('You are already on a call.');
  });
});

describe('answering a call', () => {
  const invite = (extra: Partial<IncomingSignal> = {}) =>
    from('u1', 'u1-phone', 'u2', 'c9', 'invite', { media: 'video', roomId: 'd1', ...extra });

  it('rings once, however often the invitation arrives, and connects on accept', async () => {
    const { engine, sent, now, peer, getUserMedia } = harness('u2');
    engine.handleSignal(invite());
    await settle();
    expect(now()).toMatchObject({
      phase: 'incoming',
      direction: 'incoming',
      media: 'video',
      peerId: 'u1',
      speaker: true,
    });
    expect(sent).toEqual([expect.objectContaining({ kind: 'ringing', toDevice: 'u1-phone' })]);

    // Re-sent when this phone's stream reconnected: still one call.
    engine.handleSignal(invite());
    await settle();
    expect(sent).toHaveLength(1);

    void engine.accept();
    await settle();
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: 'user' }) }),
    );
    expect(sent.at(-1)).toMatchObject({ kind: 'accept', toDevice: 'u1-phone' });
    expect(peer().added.map((track) => track.kind)).toEqual(['audio', 'video']);

    engine.handleSignal(
      from('u1', 'u1-phone', 'u2', 'c9', 'ice', { data: { candidate: { candidate: 'early' } } }),
    );
    await settle();
    expect(peer().candidates).toEqual([]);
    engine.handleSignal(from('u1', 'u1-phone', 'u2', 'c9', 'offer', { data: { sdp: 'offer-x' } }));
    await settle();
    expect(peer().remote).toEqual([{ type: 'offer', sdp: 'offer-x' }]);
    expect(peer().candidates).toEqual([{ candidate: 'early' }]);
    expect(sent.at(-1)).toMatchObject({ kind: 'answer', data: { sdp: 'answer-sdp' } });

    peer().receives('video');
    expect(now()?.hasRemoteVideo).toBe(true);
    expect(engine.remoteStream?.getTracks()).toHaveLength(1);
    peer().becomes('connected');
    await settle();
    expect(now()?.phase).toBe('active');

    engine.handleSignal(
      from('u1', 'u1-phone', 'u2', 'c9', 'state', { data: { muted: true, cameraOn: false } }),
    );
    expect(now()).toMatchObject({ remoteMuted: true, remoteCameraOn: false });

    engine.handleSignal(from('u1', 'u1-phone', 'u2', 'c9', 'hangup'));
    expect(now()).toMatchObject({ phase: 'ended', ended: 'ended' });
  });

  it('declines, and is gone at once', async () => {
    const { engine, sent, now } = harness('u2');
    engine.handleSignal(invite());
    engine.decline();
    await settle();
    expect(sent.at(-1)).toMatchObject({ kind: 'decline', toDevice: 'u1-phone' });
    expect(now()).toBeNull();
  });

  it('stops ringing, quietly, when the caller gives up or the server calls time', async () => {
    const { engine, now } = harness('u2');
    engine.handleSignal(invite());
    engine.handleSignal(
      from('u1', 'u1-phone', 'u2', 'c9', 'cancel', { data: { reason: 'cancelled' } }),
    );
    await settle();
    expect(now()).toBeNull();

    engine.handleSignal(invite({ callId: 'c10' }));
    engine.handleSignal(
      from('u1', 'server', 'u2', 'c10', 'cancel', { data: { reason: 'timeout' } }),
    );
    await settle();
    expect(now()).toBeNull();
  });

  it('is busy for a second caller while on a call', async () => {
    const { engine, sent, now } = harness('u2');
    engine.handleSignal(invite());
    await settle();
    engine.handleSignal(from('u5', 'u5-phone', 'u2', 'c11', 'invite', { media: 'audio' }));
    await settle();
    expect(sent.at(-1)).toMatchObject({
      callId: 'c11',
      kind: 'busy',
      to: 'u5',
      toDevice: 'u5-phone',
    });
    expect(now()?.id).toBe('c9');
  });

  it('steps aside when another of this person’s phones answered first', async () => {
    const { engine, now, refuse } = harness('u2');
    engine.handleSignal(invite());
    refuse.when = (signal) =>
      signal.kind === 'accept' ? new SignalError('The call was already answered.', 409) : null;
    void engine.accept();
    await settle();
    expect(now()).toBeNull();
  });

  it('listens only to the phone that is on the call', async () => {
    const { engine, now } = harness('u2');
    engine.handleSignal(invite());
    engine.handleSignal(from('u1', 'u1-laptop', 'u2', 'c9', 'cancel'));
    expect(now()?.phase).toBe('incoming');
    // Nor to signals for whoever was signed in before.
    engine.handleSignal(from('u1', 'u1-phone', 'u3', 'c9', 'cancel'));
    expect(now()?.phase).toBe('incoming');
  });
});

describe('during a call', () => {
  async function connected() {
    const call = harness('u1');
    void call.engine.start('u2', 'video');
    await settle();
    const id = call.sent[0]!.callId;
    call.engine.handleSignal(from('u2', 'u2-phone', 'u1', id, 'accept'));
    await settle();
    call.engine.handleSignal(from('u2', 'u2-phone', 'u1', id, 'answer', { data: { sdp: 'a' } }));
    await settle();
    call.peer().becomes('connected');
    await settle();
    return { ...call, id };
  }

  it('mutes and turns the camera off, and tells the other phone', async () => {
    const { engine, sent, now, opened } = await connected();
    const [audio, video] = [opened[0]!.getAudioTracks()[0]!, opened[0]!.getVideoTracks()[0]!];

    engine.toggleMute();
    await settle();
    expect(audio.enabled).toBe(false);
    expect(sent.at(-1)).toMatchObject({ kind: 'state', data: { muted: true, cameraOn: true } });

    engine.toggleCamera();
    await settle();
    expect(video.enabled).toBe(false);
    expect(now()).toMatchObject({ muted: true, cameraOn: false });
    expect(sent.at(-1)).toMatchObject({ kind: 'state', data: { muted: true, cameraOn: false } });
  });

  it('switches to the other camera without dropping the call', async () => {
    const { engine, now, peer, opened, getUserMedia } = await connected();
    const before = opened[0]!.getVideoTracks()[0]!;
    await engine.switchCamera();
    expect(getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({ facingMode: 'environment' }),
      }),
    );
    expect(before.stopped).toBe(true);
    const after = opened[0]!.getVideoTracks()[0]!;
    expect(after).not.toBe(before);
    expect(peer().senders.find((sender) => sender.track?.kind === 'video')?.track).toBe(after);
    expect(now()?.facing).toBe('environment');
  });

  it('keeps in touch with the server while it lasts', async () => {
    const { kinds } = await connected();
    const before = kinds().filter((kind) => kind === 'state').length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(kinds().filter((kind) => kind === 'state').length).toBe(before + 2);
  });

  it('tries to find its way back when the network drops, then gives up', async () => {
    const { engine, sent, now, peer } = await connected();
    peer().becomes('failed');
    await settle();
    expect(now()?.reconnecting).toBe(true);
    // The caller leads the restart.
    expect(sent.at(-1)).toMatchObject({ kind: 'offer', data: { sdp: 'offer-restart' } });

    await vi.advanceTimersByTimeAsync(RECONNECT_MS);
    expect(now()).toMatchObject({ phase: 'ended', ended: 'failed' });
    expect(sent.at(-1)).toMatchObject({ kind: 'hangup', data: { reason: 'failed' } });
    void engine;
  });

  it('carries on when the network comes back in time', async () => {
    const { now, peer } = await connected();
    peer().becomes('disconnected');
    expect(now()?.reconnecting).toBe(true);
    peer().becomes('connected');
    await vi.advanceTimersByTimeAsync(RECONNECT_MS);
    expect(now()).toMatchObject({ phase: 'active', reconnecting: false });
  });

  it('ends when the person on this phone changes', async () => {
    const { engine, sent, now } = await connected();
    engine.setIdentity('u3');
    await settle();
    expect(sent.at(-1)).toMatchObject({ kind: 'hangup', from: 'u1' });
    expect(now()?.phase).toBe('ended');
  });

  it('ignores a device that is not the one on the call', async () => {
    const { engine, now, id } = await connected();
    engine.handleSignal(from('u2', 'u2-tablet', 'u1', id, 'hangup'));
    expect(now()?.phase).toBe('active');
  });
});
