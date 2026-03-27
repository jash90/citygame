import type { ExpoConfig, ConfigContext } from 'expo/config';
import type { BrandConfig } from './brands/types';

const BRAND = process.env.BRAND ?? 'citygame';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const brandConfig: BrandConfig = require(`./brands/${BRAND}/config`).default;

const assetsDir = `./brands/${BRAND}/assets`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: brandConfig.name,
  slug: brandConfig.slug,
  scheme: brandConfig.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: `${assetsDir}/icon.png`,
  userInterfaceStyle: 'light',
  splash: {
    image: `${assetsDir}/splash.png`,
    resizeMode: 'contain',
    backgroundColor: brandConfig.colors.primary,
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: brandConfig.bundleId,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: `${assetsDir}/adaptive-icon.png`,
      backgroundColor: brandConfig.colors.primary,
    },
    package: brandConfig.bundleId,
  },
  platforms: ['ios', 'android'],
  plugins: [
    'expo-dev-client',
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission:
          'Aplikacja wymaga dostępu do kamery do skanowania kodów QR i wykonywania zdjęć w zadaniach.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Aplikacja wymaga dostępu do lokalizacji, aby wyświetlać zadania w pobliżu i weryfikować obecność w terenie.',
      },
    ],
    ['expo-secure-store'],
    './plugins/withBrandColors',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    brandName: BRAND,
    brandColors: brandConfig.colors,
    ...(brandConfig.defaultGameId
      ? { defaultGameId: brandConfig.defaultGameId }
      : {}),
  },
});
