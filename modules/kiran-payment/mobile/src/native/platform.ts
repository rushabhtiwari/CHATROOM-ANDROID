/**
 * Which container the app is running in.
 *
 * Every native adapter checks this first, because the whole app has to keep
 * working in a desktop browser: that is where it is developed on a machine
 * that cannot build for iOS at all, and where the screens are reviewed at
 * phone width before anything reaches a Simulator.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
export const isIOS = platform === 'ios';
