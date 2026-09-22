import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native container.
 *
 * `server.url` is deliberately absent. Pointing the app at a dev server is
 * convenient and is how live reload works, but a build that ships with it set
 * is a build that loads its UI over the network from a machine that may not
 * exist. It belongs in a local override, not in the committed config.
 */
const config: CapacitorConfig = {
  appId: 'in.kirancable.kiranos',
  appName: 'KiranOS',
  webDir: 'dist',
  ios: {
    // The chat's message list draws its own overscroll behaviour; the web
    // view's would fight it.
    scrollEnabled: false,
    contentInset: 'never',
    backgroundColor: '#F7F7F9',
  },
  plugins: {
    SplashScreen: {
      // Hidden from the app once the first screen paints, rather than on a
      // timer that either flashes or lingers.
      launchAutoHide: false,
      backgroundColor: '#F7F7F9',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'native' as never,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
