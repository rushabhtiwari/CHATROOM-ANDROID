/**
 * The native chrome around the web view.
 *
 * Status bar, keyboard behaviour and the splash screen. All of it is a no-op
 * on the web; none of it is worth a conditional at the call site.
 */
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNative, isIOS, isAndroid } from './platform';

export async function initShell(): Promise<void> {
  if (!isNative) return;

  if (isAndroid) {
    // Android's status bar plugin starts out drawn over the web view in black.
    // The screens pad for the bar only through safe-area insets, which the
    // Android web view does not report for it, so the bar sits above the web
    // view instead, in the app's own canvas colour. Set here rather than in
    // the shared plugin config, which iOS reads too.
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#F7F7F9' });
  }

  // Dark glyphs on the app's light surfaces.
  await StatusBar.setStyle({ style: Style.Light });

  if (isIOS) {
    // `native` resizes the web view itself when the keyboard appears, which
    // keeps a fixed composer pinned above it. The alternative, `body`, leaves
    // the composer under the keyboard in a flex column layout.
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    await Keyboard.setScroll({ isDisabled: true });
  }
}

/** Called once the first screen has painted, so the app never flashes empty. */
export const hideSplash = () => {
  if (isNative) void SplashScreen.hide();
};
