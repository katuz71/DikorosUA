import { getApps } from '@react-native-firebase/app';
import analytics from '@react-native-firebase/analytics';

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
    console.log(`🔥 [Firebase] Event: ${name}`, params);
  } catch (e) {
    console.log('[Firebase Log Error] (Are you using Dev Client?)', e);
  }
};

export const logFirebaseScreen = async (screenName: string) => {
  try {
    if (!isFirebaseReady()) return;

    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
    console.log(`🔥 [Firebase] Screen: ${screenName}`);
  } catch (e) {
     console.log('[Firebase Screen Error]', e);
  }
};
