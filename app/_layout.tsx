import { logFirebaseScreen } from '@/utils/firebaseAnalytics';
import { registerForPushNotificationsAsync } from '@/utils/pushNotifications';
import analytics from '@react-native-firebase/analytics';
import * as Notifications from 'expo-notifications';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { CategoriesProvider } from '../context/CategoriesContext';
import { OrdersProvider } from '../context/OrdersContext';
import { UserProfileProvider } from '../context/UserProfileContext';

// Обработчик пушей — SDK 50+ (NotificationBehavior без shouldShowAlert)
Notifications.setNotificationHandler({
  handleNotification: async (_notification) => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function AuthObserver({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { validateToken } = useAuth();

  useEffect(() => {
    logFirebaseScreen(pathname || 'Root');
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    // М’яка перевірка: validateToken при мережевій/шлюзній помилці повертає true (редиректу немає),
    // редирект лише при 401 (протухлий токен)
    validateToken().then((valid) => {
      if (cancelled) return;
      if (!valid) {
        router.replace('/(tabs)/profile');
      }
    });
    return () => { cancelled = true; };
  }, [pathname, validateToken]);

  return <>{children}</>;
}

export default function Layout() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await Notifications.dismissAllNotificationsAsync();
      await registerForPushNotificationsAsync();
    })();

    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string' && url) {
        router.push(url as Parameters<typeof router.push>[0]);
      }
    });
    return () => {
      subResponse.remove();
    };
  }, [router]);

  useEffect(() => {
    const initAnalytics = async () => {
      if (Platform.OS !== 'web') {
        try {
          await analytics().logEvent('app_opened');
        } catch {
          // Критичные ошибки аналитики не блокируют приложение
        }
      }
    };
    initAnalytics();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserProfileProvider>
          <OrdersProvider>
            <CategoriesProvider>
              <CartProvider>
                <AuthObserver>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
                    <Stack.Screen name="category/[id]" options={{ headerShown: false }} />
                  </Stack>
                </AuthObserver>
              </CartProvider>
            </CategoriesProvider>
          </OrdersProvider>
        </UserProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
