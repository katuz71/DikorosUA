import { FloatingChatButton } from '@/components/FloatingChatButton';
import { API_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { trackEvent } from '@/utils/analytics';
import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import { getImageUrl } from '@/utils/image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


type Variant = {
  size: string;
  price: number;
};

type Product = {
  id: number;
  name: string;
  price: number;
  image?: string;
  image_url?: string;
  picture?: string;
  category?: string;
  rating?: number;
  size?: string;
  description?: string;
  badge?: string;
  quantity?: number;
  composition?: string;
  usage?: string;
  weight?: string;
  pack_sizes?: string[];
  old_price?: number;
  unit?: string;
  variants?: Variant[];
};

export default function CartScreen() {
  const router = useRouter();
  const { items: cartItems, removeItem, clearCart, addOne, removeOne, setPromoDiscount, discount, discountAmount, appliedPromoCode, totalPrice, finalPrice } = useCart();
  const insets = useSafeAreaInsets();
  
  const formatPrice = (price: number) => {
    const safePrice = price || 0;
    return `${safePrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  };

  const [promoCode, setPromoCode] = useState('');

  useEffect(() => {
    console.log('🛒 Cart state:', { discount, discountAmount, appliedPromoCode, totalPrice, finalPrice });
  }, [discount, discountAmount, appliedPromoCode, totalPrice, finalPrice]);

  const applyPromo = async () => {
    if (!promoCode.trim()) {
      Alert.alert('Помилка', 'Введіть промокод');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/promo-codes/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎟️ Promo code validated:', data);
        
        // Устанавливаем скидку в контексте корзины
        if (data.discount_percent > 0) {
          console.log('📊 Applying percent discount:', data.discount_percent / 100);
          setPromoDiscount(data.discount_percent / 100, 0, data.code);
        } else if (data.discount_amount > 0) {
          console.log('💵 Applying amount discount:', data.discount_amount);
          setPromoDiscount(0, data.discount_amount, data.code);
        }
        
        Alert.alert('Успіх!', `Промокод ${data.code} застосовано! 🎉`);
      } else {
        const error = await response.json();
        setPromoDiscount(0, 0, '');
        Alert.alert('Помилка', error.detail || 'Невірний промокод');
      }
    } catch (error) {
      console.error('Error validating promo code:', error);
      Alert.alert('Помилка', 'Не вдалося перевірити промокод');
    }
  };

  const subtotal = cartItems.reduce((sum: number, item: Product) => {
    return sum + (item.price * (item.quantity || 1));
  }, 0);

  // Расчет итоговой суммы с учетом процентной или фиксированной скидки
  const totalAmount = discount > 0 
    ? subtotal * (1 - discount) 
    : Math.max(0, subtotal - discountAmount);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Universal Header with Absolute Center */}
      <View style={{ 
          height: 60 + insets.top, 
          backgroundColor: 'white', 
          borderBottomWidth: 1, 
          borderBottomColor: '#f0f0f0',
          paddingTop: insets.top 
      }}>
        {/* Absolute Title */}
        <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1F2937' }}>Кошик</Text>
        </View>

        {/* Buttons Layer */}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 2 }}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="black" />
            </TouchableOpacity>

            <View style={styles.headerRight}>
              {cartItems.length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    Alert.alert("Очистити кошик?", "Всі товари будуть видалені з кошика.", [
                      { text: "Скасувати", style: "cancel" },
                      { 
                        text: "Очистити", 
                        style: "destructive", 
                        onPress: () => {
                          clearCart();
                          Vibration.vibrate(100);
                        }
                      }
                    ]);
                  }}
                  style={styles.trashButton}
                >
                  <Ionicons name="trash-outline" size={24} color="#ff3b30" />
                </TouchableOpacity>
              )}
            </View>
        </View>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={cartItems.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="cart-outline" size={60} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>Кошик порожній</Text>
            <Text style={styles.emptyText}>
              Ви ще нічого не додали. Загляньте в каталог, там багато цікавого!
            </Text>
            <TouchableOpacity 
              onPress={() => router.replace('/(tabs)')}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>Перейти до каталогу</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const product = item;
          return (
            <View style={styles.itemContainer}>
              <TouchableOpacity
                onPress={() => router.push(`/product/${item.id}`)}
                style={styles.itemImageContainer}
              >
                <Image 
                  source={{ uri: getImageUrl(item.image) }} 
                  style={styles.itemImage} 
                />
              </TouchableOpacity>
              
              <View style={styles.itemInfo}>
                <Text numberOfLines={1} style={styles.itemName}>
                  {item.name}
                  {(item as any).unit && (
                    <Text style={styles.itemUnit}> ({(item as any).unit || (item as any).packSize || 'шт'})</Text>
                  )}
                </Text>
                <Text style={styles.itemPrice}>{formatPrice(item.price * (item.quantity || 1))}</Text>
              </View>

              <View style={styles.itemControls}>
                <View style={styles.quantityControls}>
                  <TouchableOpacity 
                    onPress={() => {
                      const itemUnit = (item as any).variantSize || (item as any).unit || (item as any).packSize || 'шт';
                      removeOne(item.id, itemUnit);
                    }}
                    style={styles.quantityButton}
                  >
                    <Ionicons name="remove" size={16} color="black" />
                  </TouchableOpacity>
                  
                  <Text style={styles.quantityText}>{item.quantity || 1}</Text>
                  
                  <TouchableOpacity 
                    onPress={() => {
                      const itemUnit = (item as any).variantSize || (item as any).unit || (item as any).packSize || 'шт';
                      addOne(item.id, itemUnit);
                    }}
                    style={styles.quantityButton}
                  >
                    <Ionicons name="add" size={16} color="black" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  onPress={() => {
                    Vibration.vibrate(100);
                    const itemPackSize = (item as any).packSize || (item as any).size || '30';
                    const compositeId = `${item.id}-${String(itemPackSize)}`;
                    removeItem(compositeId);
                  }}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color="#999" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.promoContainer}>
            <TextInput
              placeholder="Промокод (напр. START)"
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
              style={styles.promoInput}
            />
            <TouchableOpacity onPress={applyPromo} style={styles.promoButton}>
              <Text style={styles.promoButtonText}>Застосувати</Text>
            </TouchableOpacity>
          </View>

          {(discount > 0 || discountAmount > 0) && (
            <Text style={styles.discountText}>
              Промокод {appliedPromoCode} застосовано! 
              {discount > 0 ? ` Знижка ${discount * 100}%` : ` Знижка ${Math.round(discountAmount)} ₴`} 🎉
            </Text>
          )}

          <Text style={styles.totalText}>
            <Text>Разом: </Text>
            <Text>{formatPrice(totalAmount)}</Text>
          </Text>

          <TouchableOpacity
            disabled={cartItems.length === 0}
            onPress={async () => {
              // Отправка события начала оформления заказа в аналитику
              const productsForAnalytics = cartItems.map((item: Product) => ({
                ...item,
                title: item.name,
                price: item.price
              }));
              
              try {
                trackEvent('InitiateCheckout', {
                  value: totalAmount,
                  currency: 'UAH',
                  num_items: cartItems.length,
                  content_ids: cartItems.map((i: any) => i.id),
                  content_type: 'product',
                  items: cartItems.map((i: any) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity || 1 }))
                });

                logFirebaseEvent('begin_checkout', {
                  currency: 'UAH',
                  value: totalAmount,
                  items: cartItems.map((i: any) => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.quantity || 1 }))
                });
              } catch (error) {
                console.error('Error logging begin checkout:', error);
              }
              
              router.push('/checkout');
            }}
            style={[
              styles.checkoutButton,
              cartItems.length === 0 && styles.checkoutButtonDisabled
            ]}
          >
            <Text style={styles.checkoutButtonText}>Оформити замовлення</Text>
          </TouchableOpacity>
        </View>
      )}

      <FloatingChatButton bottomOffset={30} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    // paddingTop: 50, // Удалено, теперь динамически
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  trashButton: {
    padding: 5,
  },
  emptyContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',  // Центрируем по вертикали
    alignItems: 'center',
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    // marginTop: 100, // Убираем marginTop, используем flex контейнера
    width: '100%',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1F2937',
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    width: '80%',
    lineHeight: 24,
    fontSize: 16,
  },
  emptyButton: {
    backgroundColor: '#458B00', // Брендовый цвет из профиля
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12, // Как в профиле (inviteBanner)
    shadowColor: '#458B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContent: {
    padding: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 10,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemImageContainer: {
    marginRight: 15,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 0,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemUnit: {
    fontWeight: 'normal',
    color: '#666',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 5,
  },
  itemControls: {
    alignItems: 'flex-end',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 2,
    marginBottom: 8,
  },
  quantityButton: {
    padding: 6,
  },
  quantityText: {
    marginHorizontal: 8,
    fontWeight: 'bold',
    fontSize: 14,
  },
  deleteButton: {
    padding: 5,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 5,
  },
  footer: {
    padding: 20,
    paddingBottom: 100,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  promoContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    marginTop: 10,
  },
  promoInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 10,
    marginRight: 10,
    fontSize: 14,
  },
  promoButton: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  promoButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  discountText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  totalText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#000',
  },
  checkoutButton: {
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

