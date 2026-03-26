import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tinycloset.app',
  appName: 'Tiny Closet',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'Tiny Closet'
  },
  server: {
    iosScheme: 'capacitor'
  }
};

export default config;
