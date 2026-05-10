import { ExpoConfig, ConfigContext } from 'expo/config';
import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...appJson.expo,
  ...config,
  extra: {
    ...appJson.expo.extra,
    buildTimestamp: new Date().toISOString(),
    googleOAuth: {
      iosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
      androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
      webClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
    },
  },
});
