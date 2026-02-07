import analytics from '@react-native-firebase/analytics';
import { getApps } from '@react-native-firebase/app';

/**
 * Helper to safely check if Firebase is initialized
 * Uses getApps() to match modular SDK and avoid deprecation warnings
 */
const isFirebaseReady = () => {
  try {
    const apps = getApps();
    return apps && apps.length > 0;
  } catch (e) {
    return false;
  }
};

export const logFirebaseEvent = async (name: string, params: any = {}) => {
  try {
    if (!isFirebaseReady()) return;
    
    await analytics().logEvent(name, params);
  } catch (e) {
    // Ignore Firebase errors in dev
  }
};

export const logFirebaseScreen = async (screenName: string) => {
  try {
    if (!isFirebaseReady()) return;

    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch (e) {
    // Ignore Firebase errors in dev
  }
};
