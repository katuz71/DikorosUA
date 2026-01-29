import { Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { logFirebaseScreen } from '@/utils/firebaseAnalytics';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CartProvider } from '../context/CartContext';
import { OrdersProvider } from '../context/OrdersContext';

export default function Layout() {
  const pathname = usePathname();

  useEffect(() => {
    logFirebaseScreen(pathname || 'Root'); // Трекаем экраны
  }, [pathname]);

  return (
    <SafeAreaProvider>
      <OrdersProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }}>
            {/* Главный экран - это табы */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            
            {/* Экран товара */}
            <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
            
            {/* Оформление заказа */}
            <Stack.Screen name="checkout" options={{ headerShown: false }} />
          </Stack>
        </CartProvider>
      </OrdersProvider>
    </SafeAreaProvider>
  );
}
