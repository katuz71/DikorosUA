import analytics from '@react-native-firebase/analytics';

export const logFirebaseEvent = async (name: string, params: any = {}) => {
  try {
    await analytics().logEvent(name, params);
    console.log(`🔥 [Firebase] ${name}`, params);
  } catch (e) {
    console.log('[Firebase Log Error] (Are you using Dev Client?)', e);
  }
};

export const logFirebaseScreen = async (screenName: string) => {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
    console.log(`🔥 [Firebase] Screen: ${screenName}`);
  } catch (e) {
     console.log('[Firebase Screen Error]', e);
  }
};
