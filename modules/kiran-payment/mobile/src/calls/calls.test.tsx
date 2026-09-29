import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatProvider } from '@/lib/chat-store';
import { createLocalLog } from '@/lib/chat-log';
import { I18nProvider } from '@/lib/i18n';
import { RtsProvider } from '@/modules/rts/store';
import App from '~/App';
import { CallProvider } from '~/calls/CallProvider';
import type { CallRecord, IncomingSignal } from '~/calls/types';
import { renderApp } from '~/test/render';
import state from '~/test/fixtures/state.json';

/*
 * The app with calls switched on, as main.tsx mounts it, against a stand-in
 * call server: the stream is an EventSource the test speaks through, and every
 * signal the app sends is kept for the test to read.
 */

class FakeEventSource {
  static open: FakeEventSource[] = [];
  readonly url: string;
  onerror: (() => void) | null = null;
  closed = false;
  private listeners = new Map<string, Array<(event: MessageEvent) => void>>();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.open.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }
}

class FakeTrack {
  enabled = true;
  constructor(readonly kind: 'audio' | 'video') {}
  stop() {}
}

class FakeStream {
  constructor(private tracks: FakeTrack[] = []) {}
  getTracks() {
    return this.tracks;
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
}

/** Just enough of a peer connection for a call to get through to "connected". */
class FakePeer {
  static last: FakePeer | null = null;
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  onicecandidate: (() => void) | null = null;
  ontrack: ((event: { track: FakeTrack }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  constructor() {
    FakePeer.last = this;
  }
  addTrack() {
    return { track: null, replaceTrack: async () => {} };
  }
  getSenders() {
    return [];
  }
  async createOffer() {
    return { type: 'offer' as const, sdp: 'offer' };
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: 'answer' };
  }
  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription() {
    this.signalingState = 'stable';
  }
  async addIceCandidate() {}
  close() {}
  /** Their camera arrives and the line comes up. */
  connects() {
    this.ontrack?.({ track: new FakeTrack('video') });
    this.connectionState = 'connected';
    this.onconnectionstatechange?.();
  }
}

/** A phone with a microphone and a camera that say yes. */
function withMicrophone() {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(
        async (constraints: MediaStreamConstraints) =>
          new FakeStream([
            new FakeTrack('audio'),
            ...(constraints.video ? [new FakeTrack('video')] : []),
          ]),
      ),
    },
  });
}

beforeEach(() => {
  // jsdom has media elements but cannot play them.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
  FakeEventSource.open = [];
  Reflect.deleteProperty(navigator, 'mediaDevices');
  vi.restoreAllMocks();
});

const HOUR = 3_600_000;

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderWithCalls(route: string, history: CallRecord[] = []) {
  const signals: IncomingSignal[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/api/state')) return Response.json(state);
      if (url.startsWith('/api/calls/history')) return Response.json({ calls: history });
      if (url === '/api/calls/signal') {
        signals.push(JSON.parse(String(init?.body)) as IncomingSignal);
        return Response.json({ delivered: 1 });
      }
      return new Response('Not in the test server', { status: 404 });
    }),
  );
  vi.stubGlobal('EventSource', FakeEventSource);
  render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <ChatProvider log={createLocalLog({ failureRate: 0, latency: 10 })}>
          <RtsProvider>
            <CallProvider>
              <App />
              <Location />
            </CallProvider>
          </RtsProvider>
        </ChatProvider>
      </I18nProvider>
    </MemoryRouter>,
  );

  const stream = () => {
    const found = FakeEventSource.open.find(
      (source) => source.url.startsWith('/api/calls/events') && !source.closed,
    );
    if (!found) throw new Error('The app is not listening for calls.');
    return found;
  };
  return {
    signals,
    kinds: () => signals.map((signal) => signal.kind),
    stream,
    /** The server says hello: the stream is open. */
    connect: () => act(() => stream().emit('ready', { iceServers: [] })),
    /** A signal arrives for the person signed in (u1). */
    receive: (signal: Omit<IncomingSignal, 'to'>) =>
      act(() => stream().emit('signal', { to: 'u1', ...signal })),
  };
}

const location = () => screen.getByTestId('location').textContent;

describe('where calls start', () => {
  it('offers voice and video calls in a one-to-one chat', async () => {
    renderWithCalls('/chats/d1');
    expect(await screen.findByRole('button', { name: 'Voice call' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Video call' })).toBeInTheDocument();
  });

  it('offers none in a group, where calls are not one to one', async () => {
    renderWithCalls('/chats/r1');
    await screen.findByRole('button', { name: 'Open the assistant' });
    expect(screen.queryByRole('button', { name: 'Voice call' })).not.toBeInTheDocument();
  });

  it('has no calls at all without the call server around it', async () => {
    await renderApp('/chats/d1');
    await screen.findByRole('button', { name: 'Open the assistant' });
    expect(screen.queryByRole('button', { name: 'Voice call' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to chats' }));
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).queryByRole('link', { name: /Calls/ })).not.toBeInTheDocument();
  });
});

describe('placing a call', () => {
  it('shows who is being called, rings once their phone does, and can be called off', async () => {
    withMicrophone();
    const server = renderWithCalls('/chats/d1');
    server.connect();

    fireEvent.click(await screen.findByRole('button', { name: 'Voice call' }));
    const call = await screen.findByRole('dialog', { name: 'Call with Ananya Iyer' });
    expect(within(call).getByText('Calling…')).toBeInTheDocument();
    await waitFor(() => expect(server.kinds()).toEqual(['invite']));
    expect(server.signals[0]).toMatchObject({ from: 'u1', to: 'u2', media: 'audio', roomId: 'd1' });

    const callId = server.signals[0]!.callId;
    server.receive({ callId, kind: 'ringing', from: 'u2', fromDevice: 'their-phone' });
    expect(within(call).getByText('Ringing…')).toBeInTheDocument();

    fireEvent.click(within(call).getByRole('button', { name: 'End call' }));
    await waitFor(() => expect(server.kinds()).toEqual(['invite', 'cancel']));
    expect(within(call).getByText('Call ended')).toBeInTheDocument();
  });

  it('shows their face once connected, and their picture when they turn the camera off', async () => {
    withMicrophone();
    vi.stubGlobal('RTCPeerConnection', FakePeer);
    vi.stubGlobal('MediaStream', FakeStream);
    const server = renderWithCalls('/chats/d1');
    server.connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Video call' }));
    const call = await screen.findByRole('dialog', { name: 'Call with Ananya Iyer' });
    // Ringing: your own camera fills the screen.
    expect(within(call).getByLabelText('Your camera')).toBeInTheDocument();
    await waitFor(() => expect(server.kinds()).toEqual(['invite']));

    const callId = server.signals[0]!.callId;
    const them = { callId, from: 'u2', fromDevice: 'their-phone' };
    server.receive({ ...them, kind: 'accept' });
    await waitFor(() => expect(server.kinds()).toContain('offer'));
    server.receive({ ...them, kind: 'answer', data: { sdp: 'answer' } });
    act(() => FakePeer.last!.connects());

    expect(await within(call).findByLabelText("Ananya Iyer's camera")).toBeInTheDocument();
    expect(within(call).getByText('0:00')).toBeInTheDocument();

    server.receive({ ...them, kind: 'state', data: { muted: false, cameraOn: false } });
    expect(within(call).getByText(/Ananya turned their camera off/)).toBeInTheDocument();
    expect(within(call).queryByLabelText("Ananya Iyer's camera")).not.toBeInTheDocument();
    // Yours stays in the corner rather than taking over the screen.
    expect(within(call).getByLabelText('Your camera')).toBeInTheDocument();
  });

  it('tucks away into a pill, and comes back from it', async () => {
    withMicrophone();
    const server = renderWithCalls('/chats/d1');
    server.connect();
    fireEvent.click(await screen.findByRole('button', { name: 'Video call' }));
    const call = await screen.findByRole('dialog', { name: 'Call with Ananya Iyer' });

    fireEvent.click(within(call).getByRole('button', { name: 'Minimise the call' }));
    expect(screen.queryByRole('dialog', { name: 'Call with Ananya Iyer' })).not.toBeInTheDocument();
    // The chat underneath is usable.
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Return to the call with Ananya Iyer' }));
    expect(screen.getByRole('dialog', { name: 'Call with Ananya Iyer' })).toBeInTheDocument();
  });
});

describe('an incoming call', () => {
  const invite = (media: 'audio' | 'video' = 'audio') => ({
    callId: 'call-in-1',
    kind: 'invite' as const,
    from: 'u2',
    fromDevice: 'their-phone',
    media,
    roomId: 'd1',
  });

  it('rings over whatever screen is open, and declining tells the caller', async () => {
    const server = renderWithCalls('/orders');
    server.connect();
    server.receive(invite());

    const call = await screen.findByRole('dialog', { name: 'Call with Ananya Iyer' });
    expect(within(call).getByText('Incoming voice call')).toBeInTheDocument();
    await waitFor(() => expect(server.kinds()).toEqual(['ringing']));

    fireEvent.click(within(call).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(server.kinds()).toEqual(['ringing', 'decline']));
    expect(server.signals[1]).toMatchObject({ to: 'u2', toDevice: 'their-phone' });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Call with Ananya Iyer' }),
      ).not.toBeInTheDocument(),
    );
    expect(location()).toBe('/orders');
  });

  it('stops ringing when the caller gives up', async () => {
    const server = renderWithCalls('/chats');
    server.connect();
    server.receive(invite('video'));
    expect(await screen.findByText('Incoming video call')).toBeInTheDocument();
    server.receive({ callId: 'call-in-1', kind: 'cancel', from: 'u2', fromDevice: 'their-phone' });
    await waitFor(() => expect(screen.queryByText('Incoming video call')).not.toBeInTheDocument());
  });

  it('says what is missing when the phone will not give up its microphone', async () => {
    const server = renderWithCalls('/chats');
    server.connect();
    server.receive(invite('video'));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    expect(
      await screen.findByText('Allow the camera and microphone to make video calls'),
    ).toBeInTheDocument();
    await waitFor(() => expect(server.kinds()).toEqual(['ringing', 'decline']));
  });
});

describe('the Calls tab', () => {
  const now = Date.now();
  const history: CallRecord[] = [
    {
      id: 'c-missed',
      from: 'u2',
      to: 'u1',
      media: 'audio',
      roomId: 'd1',
      status: 'ended',
      outcome: 'missed',
      startedAt: now - HOUR,
      answeredAt: null,
      endedAt: now - HOUR + 45_000,
    },
    {
      id: 'c-talked',
      from: 'u1',
      to: 'u4',
      media: 'video',
      roomId: 'd2',
      status: 'ended',
      outcome: 'completed',
      startedAt: now - 2 * HOUR,
      answeredAt: now - 2 * HOUR + 5_000,
      endedAt: now - 2 * HOUR + 130_000,
    },
  ];

  it('counts missed calls on the tab until the list is looked at', async () => {
    const server = renderWithCalls('/chats', history);
    server.connect();
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(await within(nav).findByLabelText('1 missed')).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole('link', { name: /Calls/ }));
    expect(location()).toBe('/calls');
    await waitFor(() => expect(within(nav).queryByLabelText('1 missed')).not.toBeInTheDocument());
  });

  it('lists who called whom, which way, and for how long, and calls back the same way', async () => {
    withMicrophone();
    const server = renderWithCalls('/calls', history);
    server.connect();

    const list = await screen.findByRole('list', { name: 'Recent calls' });
    const [missed, talked] = within(list).getAllByRole('listitem');
    expect(within(missed!).getByText('Ananya Iyer')).toHaveClass('text-destructive');
    expect(within(missed!).getByText(/^Missed · Today/)).toBeInTheDocument();
    expect(within(talked!).getByText('Priya Raghavan')).not.toHaveClass('text-destructive');
    expect(within(talked!).getByText(/^Outgoing · Today, .* · 2:05$/)).toBeInTheDocument();

    fireEvent.click(within(talked!).getByRole('button', { name: 'Video call Priya Raghavan' }));
    await waitFor(() => expect(server.kinds()).toEqual(['invite']));
    expect(server.signals[0]).toMatchObject({ to: 'u4', media: 'video', roomId: 'd2' });
  });

  it('starts a call with anyone in the directory', async () => {
    withMicrophone();
    const server = renderWithCalls('/calls');
    server.connect();
    expect(await screen.findByText('No calls yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New call' }));
    const sheet = screen.getByRole('dialog', { name: 'New call' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Voice call Imran Shaikh' }));
    await waitFor(() => expect(server.kinds()).toEqual(['invite']));
    expect(server.signals[0]).toMatchObject({ to: 'u5', media: 'audio' });
    expect(
      await screen.findByRole('dialog', { name: 'Call with Imran Shaikh' }),
    ).toBeInTheDocument();
  });

  it('says when this phone cannot be reached for calls', async () => {
    const server = renderWithCalls('/calls');
    expect(await screen.findByText(/Not connected to the call server/)).toBeInTheDocument();
    server.connect();
    await waitFor(() =>
      expect(screen.queryByText(/Not connected to the call server/)).not.toBeInTheDocument(),
    );
  });
});
