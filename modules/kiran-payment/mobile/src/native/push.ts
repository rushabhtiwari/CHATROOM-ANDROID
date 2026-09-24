/**
 * Push notifications.
 *
 * What is real here is the plumbing: permission, APNs registration, the token
 * handed to wherever it will eventually be stored, and the routing that turns
 * a tapped notification into a screen. What does not exist yet is anything to
 * push *from* — neither the chat server nor the orders API has been built, so
 * no remote notification will arrive until they are.
 *
 * Rather than fake that, the app also schedules *local* notifications from the
 * chat store's own notification feed. Those are genuine: they are how a
 * backgrounded app tells you about a mention it already knows about. When the
 * servers land, the same `handleTap` routing serves both.
 */
import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';

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
  if (!isNative) return false;

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

  await LocalNotifications.requestPermissions();
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const destination = destinationFrom(action.notification.extra);
    if (destination) onTap(destination);
  });

  return true;
}

/**
 * Raise a local notification for something the app already knows about.
 *
 * Used for mentions arriving while the app is backgrounded. Delivered
 * immediately; the id has to be a 32-bit integer, so it is derived from the
 * source id rather than being the id itself.
 */
export async function notifyLocally(input: {
  id: string;
  title: string;
  body: string;
  destination: Destination;
}): Promise<void> {
  if (!isNative) return;

  let hash = 0;
  for (const char of input.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.abs(hash),
        title: input.title,
        body: input.body,
        extra: input.destination,
      },
    ],
  });
}
