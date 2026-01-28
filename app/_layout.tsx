import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CartProvider } from '../context/CartContext';
import { OrdersProvider } from '../context/OrdersContext';

export default function Layout() {
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
