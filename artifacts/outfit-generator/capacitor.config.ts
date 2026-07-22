import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalsports.app',
  appName: 'My Sports',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents white flash on launch
    backgroundColor: '#F9F4EE',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,

    // -------------------------------------------------------------------------
    // Privacy usage descriptions — all three are required for camera/photo access.
    // Missing any one causes a SIGABRT crash (TCC violation) or silent refusal.
    // -------------------------------------------------------------------------
    infoPlist: {
      NSCameraUsageDescription:
        'My Digital Sports needs camera access so you can photograph clothing items to add to your wardrobe.',
      NSPhotoLibraryUsageDescription:
        'My Digital Sports needs photo library access so you can choose clothing photos from your library.',
      NSPhotoLibraryAddUsageDescription:
        'My Digital Sports saves photos you take with the camera to your photo library.',
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#F9F4EE',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F9F4EE',
      overlaysWebView: true,
    },
  },
};

export default config;
