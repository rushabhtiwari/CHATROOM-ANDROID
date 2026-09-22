/**
 * Real connectivity, in place of the simulated switch.
 *
 * The chat store carries an `online` flag that the console drives from a
 * developer toggle, because its transport is a simulation. On a phone the
 * question is not hypothetical — a lift, a basement and airplane mode are the
 * normal case — so this binds that same flag to the device's actual state and
 * the retry queue becomes a real mechanism rather than a demonstration.
 */
import { Network } from '@capacitor/network';
import { isNative } from './platform';

export type OnlineListener = (online: boolean) => void;

export async function watchConnectivity(onChange: OnlineListener): Promise<() => void> {
  if (!isNative) {
    const online = () => onChange(true);
    const offline = () => onChange(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    onChange(navigator.onLine);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }

  const status = await Network.getStatus();
  onChange(status.connected);
  const handle = await Network.addListener('networkStatusChange', (next) => {
    onChange(next.connected);
  });
  return () => void handle.remove();
}
