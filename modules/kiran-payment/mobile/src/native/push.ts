/**
 * Push notifications.
 *
 * What is real here is the plumbing: permission, APNs registration, the token
 * handed to wherever it will eventually be stored, and the routing that turns
 * a tapped notification into a screen. What does not exist yet is anything to
 * push *from* — neither the chat server nor the orders API has been built, so
 * no remote notification will arrive until they are.
 *
 * There are deliberately no *local* notifications. The design once had the
 * app re-raise its own notification feed while backgrounded, but iOS suspends
 * a backgrounded app's JavaScript within seconds, and with no chat server
 * nothing arrives in that window to re-raise. Once a server exists, background
 * notifications have to come from it over APNs — and local ones alongside
 * would only arrive twice.
 */
import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { isAndroid, isNative } from './platform';

/**
 * Android delivers pushes through Firebase Cloud Messaging, which needs the
 * project's `google-services.json` compiled into the app. Without it the
 * plugin's `register()` throws on the native side and takes the whole app
 * down with it, so an Android build registers only when it was built with
 * that file — the build sets this flag when it finds one.
 */
const pushAvailable = !isAndroid || import.meta.env.VITE_ANDROID_PUSH === 'true';

/** Where a notification says the user should end up. */
export type Destination =
  | { kind: 'room'; roomId: string; messageId?: string }
  | { kind: 'dispatch'; dispatchId: string }
  | { kind: 'order'; orderId: string };

/** Reads a destination out of a notification payload, if it carries one. */
export function destinationFrom(data: Record<string, unknown> | undefined): Destination | null {
  if (!data) return null;
  if (typeof data.roomId === 'string') {
    return {
      kind: 'room',
      roomId: data.roomId,
      messageId: typeof data.messageId === 'string' ? data.messageId : undefined,
    };
  }
  if (typeof data.dispatchId === 'string') return { kind: 'dispatch', dispatchId: data.dispatchId };
  if (typeof data.orderId === 'string') return { kind: 'order', orderId: data.orderId };
  return null;
}

export interface PushHandlers {
  /** The APNs token. Registering it with a server is sub-project #2's work. */
  onToken: (token: string) => void;
  /** A notification was tapped. */
  onTap: (destination: Destination) => void;
}

/**
 * Ask for permission and register.
 *
 * Returns false when permission is refused, which is a supported state: the
 * app stays fully usable and simply never raises a notification. It is not
 * re-asked, because iOS only ever shows the prompt once.
 */
export async function initPush({ onToken, onTap }: PushHandlers): Promise<boolean> {
  if (!isNative || !pushAvailable) return false;

  const existing = await PushNotifications.checkPermissions();
  const granted =
    existing.receive === 'granted' ? existing : await PushNotifications.requestPermissions();
  if (granted.receive !== 'granted') return false;

  await PushNotifications.addListener('registration', (token: Token) => onToken(token.value));
  await PushNotifications.addListener('registrationError', (error) => {
    // Nothing the user can act on, and no reason to block the app.
    console.warn('APNs registration failed', error);
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const destination = destinationFrom(action.notification.data);
    if (destination) onTap(destination);
  });
  await PushNotifications.register();

  return true;
}
