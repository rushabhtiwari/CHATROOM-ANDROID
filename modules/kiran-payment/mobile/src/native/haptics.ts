/**
 * Touch feedback.
 *
 * Silent on the web rather than absent, so screens can call it unconditionally
 * instead of guarding every use.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

export const tap = () => {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light });
};

/** A message left the composer, a reaction landed. */
export const selection = () => {
  if (isNative) void Haptics.selectionChanged();
};

/** A send failed, a dispatch is blocked. */
export const warn = () => {
  if (isNative) void Haptics.notification({ type: NotificationType.Warning });
};
