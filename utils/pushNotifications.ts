import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Полная регистрация пуш-уведомлений: разрешения, канал (Android), получение токена.
 * Вызывать при запуске приложения (например, в _layout).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  console.log('🔥 [PUSH] Начинаем регистрацию...');

  if (!Device.isDevice) {
    console.log('🔥 [PUSH] Ошибка: Это симулятор, пуши не сработают!');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('🔥 [PUSH] Текущий статус разрешений:', existingStatus);

  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    console.log('🔥 [PUSH] Запрашиваем разрешение у пользователя...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('🔥 [PUSH] Ответ пользователя:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    console.log('🔥 [PUSH] Пользователь запретил уведомления!');
    return null;
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Замовлення та акції',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
      console.log('🔥 [PUSH] Канал default создан');
    } catch (e) {
      console.log('🔥 [PUSH] Ошибка создания канала:', e);
      return null;
    }
  }

  const expoToken = await getPushTokenAsync();
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    console.log('🔥 [PUSH] Device Push Token (FCM/native):', JSON.stringify(deviceToken));
  } catch (e) {
    console.log('🔥 [PUSH] Device Push Token недоступен:', e);
  }
  return expoToken;
}

/**
 * Только получение Expo Push Token (без запроса разрешений).
 * Использовать, когда регистрация уже выполнена при старте приложения.
 */
export async function getPushTokenAsync(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });
    const token = tokenData?.data ?? null;
    if (token) {
      console.log('🔥 [PUSH] УСПЕХ! Expo Push Token:', token);
    } else {
      console.log('🔥 [PUSH] Токен не получен (tokenData.data пустой)');
    }
    return token;
  } catch (e) {
    console.log('🔥 [PUSH] Ошибка при получении токена:', e);
    return null;
  }
}
