import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { logFirebaseScreen } from '@/utils/firebaseAnalytics';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CartProvider } from '../context/CartContext';
import { OrdersProvider } from '../context/OrdersContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { UserProfileProvider } from '../context/UserProfileContext';

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
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserProfileProvider>
          <OrdersProvider>
            <CartProvider>
              <AuthObserver>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
                </Stack>
              </AuthObserver>
            </CartProvider>
          </OrdersProvider>
        </UserProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
