/**
 * The parts of a call only Android itself can do: which speaker the voice
 * comes out of, the screen going dark against your ear, ringing while the app
 * is not on screen, and keeping the microphone and camera when you switch to
 * another app mid-call.
 *
 * The plugin is android/app/src/main/java/in/kirancable/kiranos/CallsPlugin.java.
 * Everywhere else — iOS, the browser, the tests — each of these does nothing,
 * so a call works the same, only without them.
 */
import { registerPlugin } from '@capacitor/core';
import { isAndroid } from '~/native/platform';

interface KiranCallsPlugin {
  setSpeaker(options: { on: boolean }): Promise<void>;
  setInCall(options: { active: boolean; proximity: boolean }): Promise<void>;
  showIncoming(options: { title: string; body: string }): Promise<void>;
  clearIncoming(): Promise<void>;
  startOngoing(options: { title: string; video: boolean }): Promise<void>;
  stopOngoing(): Promise<void>;
  requestNotifications(): Promise<{ granted: boolean }>;
}

const KiranCalls = registerPlugin<KiranCallsPlugin>('KiranCalls');

/** A native step that fails leaves the call itself untouched. */
function quietly(run: () => Promise<unknown>): void {
  if (!isAndroid) return;
  void run().catch((error: unknown) => console.warn('KiranCalls:', error));
}

export const callNative = {
  /** Loudspeaker, or the earpiece (a headset, when one is connected). */
  speaker: (on: boolean) => quietly(() => KiranCalls.setSpeaker({ on })),
  /** Keep the screen on for a call, and let it go dark at the ear when `proximity`. */
  inCall: (active: boolean, proximity: boolean) =>
    quietly(() => KiranCalls.setInCall({ active, proximity })),
  /** Ring from the notification shade, for a call that arrives while the app is away. */
  showIncoming: (title: string, body: string) =>
    quietly(() => KiranCalls.showIncoming({ title, body })),
  clearIncoming: () => quietly(() => KiranCalls.clearIncoming()),
  /** Android cuts off a background app's microphone and camera unless it says it is on a call. */
  startOngoing: (title: string, video: boolean) =>
    quietly(() => KiranCalls.startOngoing({ title, video })),
  stopOngoing: () => quietly(() => KiranCalls.stopOngoing()),
  /** Android 13 and later: a call that rings in the background is a notification. */
  askForNotifications: () => quietly(() => KiranCalls.requestNotifications()),
};
