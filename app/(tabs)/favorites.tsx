import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Animated, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useCart } from '@/context/CartContext';
import { trackEvent } from '@/utils/analytics';
import { getImageUrl } from '@/utils/image';
import { FloatingChatButton } from '@/components/FloatingChatButton';

export default function FavoritesScreen() {
  const router = useRouter();
  const { addItem } = useCart();
  const { favorites, toggleFavorite, clearFavorites } = useFavoritesStore();
  const insets = useSafeAreaInsets();

  // Динамические стили с insets
  const headerStyle = {
    height: 60 + insets.top,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: insets.top,
  };

  // Функция форматирования цены
  const formatPrice = (price: number) => {
    const safePrice = price || 0;
    return `${safePrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  };

  // Добавить товар в корзину
  const addToCart = (item: any) => {
    console.log('🛒 Добавляю в корзину:', item);
    
    if (!item || !item.id) {
      console.error('❌ Некорректный товар для добавления в корзину:', item);
      showToast('Помилка: товар не знайдено');
      return;
    }
    
    try {
      addItem(item, 1, item.unit || 'шт');
      console.log('✅ Товар успешно добавлен в корзину:', item.name);
      
      // Analytics
      trackEvent('AddToCart', {
         content_ids: [item.id],
         content_type: 'product',
         value: item.price,
         currency: 'UAH',
         content_name: item.name,
         items: [{ item_id: item.id, item_name: item.name, price: item.price }]
      });

      // Визуальное подтверждение
      showToast('Товар додано в кошик');
    } catch (error) {
      console.error('❌ Ошибка при добавлении в корзину:', error);
      showToast('Не вдалося додати товар в кошик');
    }
  };

  // Переход к товару
  const goToProduct = (item: any) => {
    if (item?.id) {
      router.push(`/product/${item.id}`);
    }
  };

  // Удалить из избранного
  const removeFromFavoritesHandler = (item: any) => {
    if (item?.id) {
      toggleFavorite(item);
    }
  };

  // Очистить все избранное
  const clearAllFavorites = () => {
    if (favorites.length > 0) {
      Alert.alert(
        'Очистити обране',
        `Ви впевнені, що хочете видалити всі ${favorites.length} товарів з обраного?`,
        [
          {
            text: 'Скасувати',
            style: 'cancel',
          },
          {
            text: 'Очистити',
            style: 'destructive',
            onPress: () => {
              console.log('🗑️ Очищаем все избранное:', favorites.length, 'товаров');
              clearFavorites();
              showToast('Обране очищено');
            },
          },
        ]
      );
    }
  };

  // Функция для показа toast сообщений
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    
    // Анимация появления
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    
    // Автоматическое скрытие через 2 секунды
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToastVisible(false);
      });
    }, 2000);
  };

  // Состояние для ошибок изображений
  const [imageErrors, setImageErrors] = React.useState<{[key: string]: boolean}>({});

  // Состояние для toast
  const [toastVisible, setToastVisible] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Обработка ошибки изображения
  const handleImageError = (itemId: string | number) => {
    if (itemId !== undefined && itemId !== null) {
      setImageErrors(prev => ({ ...prev, [itemId.toString()]: true }));
    }
  };

  // Рендер карточки товара
  const renderFavoriteItem = ({ item }: { item: any }) => {
    const imageError = item.id ? (imageErrors[item.id] || false) : false;
    const hasDiscount = item.old_price && item.old_price > item.price;
    const discountPercent = hasDiscount 
      ? Math.round((1 - item.price / item.old_price) * 100) 
      : 0;

    return (
      <View style={styles.productCard}>
        {/* Изображение */}
        <TouchableOpacity 
          style={styles.imageContainer}
          onPress={() => goToProduct(item)}
          activeOpacity={0.8}
        >
          {!imageError ? (
            <Image 
              source={{ uri: getImageUrl(item.image) }} 
              style={styles.productImage}
              onError={() => item.id && handleImageError(item.id)}
            />
          ) : (
            <View style={[styles.productImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={40} color="#d1d5db" />
            </View>
          )}
          {item.badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Информация о товаре */}
        <View style={styles.productInfo}>
          {/* Название */}
          <TouchableOpacity 
            onPress={() => goToProduct(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>

          {/* Категория */}
          {item.category && (
            <Text style={styles.category}>{item.category}</Text>
          )}

          {/* Цена */}
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>{formatPrice(item.price)}</Text>
            {hasDiscount && (
              <>
                <Text style={styles.oldPrice}>{formatPrice(item.old_price)}</Text>
                {discountPercent > 0 && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>-{discountPercent}%</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Кнопки действий */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.addToCartButton}
              onPress={() => addToCart(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="cart-outline" size={16} color="white" />
              <Text style={styles.addToCartText}>В кошик</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => removeFromFavoritesHandler(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Пустое состояние
  if (favorites.length === 0) {
    return (
      <View style={styles.container}>
        <View style={headerStyle}>
          {/* Absolute Centered Title */}
          <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
            <Text style={styles.headerTitle}>Обране</Text>
          </View>
        </View>
        
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="heart-outline" size={60} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>Ваш список порожній</Text>
          <Text style={styles.emptySubtitle}>
            Додайте товари в обране, щоб не загубити їх
          </Text>
          <TouchableOpacity 
            style={styles.shopButton}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.8}
          >
            {/* Иконку убираем для единообразия с корзиной */}
            <Text style={styles.shopButtonText}>Перейти до покупок</Text>
          </TouchableOpacity>
        </View>
        <FloatingChatButton bottomOffset={30} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Хедер */}
      <View style={headerStyle}>
        {/* Absolute Centered Title */}
        <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
          <Text style={styles.headerTitle}>Обране</Text>
        </View>

        {/* Action Buttons Layer */}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 2 }}>
           {/* Left placeholder if needed */}
           <View style={{ width: 40 }} />
           
           {/* Right Button */}
           <View style={{ width: 'auto' }}>
             {favorites.length > 0 && (
              <TouchableOpacity 
                onPress={clearAllFavorites}
                style={styles.clearButton}
                activeOpacity={0.7}
              >
                <Text style={styles.clearButtonText}>Очистити</Text>
              </TouchableOpacity>
             )}
           </View>
        </View>
      </View>

      {/* Список товаров */}
      <FlatList
        data={favorites}
        renderItem={renderFavoriteItem}
        keyExtractor={(item) => item?.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        numColumns={1}
      />

      {/* ELEGANT TOP TOAST */}
      {toastVisible && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 60,
            alignSelf: 'center',
            backgroundColor: 'rgba(30, 30, 30, 0.85)',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 50,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 5,
            zIndex: 10000,
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0]
              })
            }]
          }}
        >
          <Ionicons 
            name={toastMessage.includes('Видалено') ? "trash-outline" : "checkmark-circle"} 
            size={20} 
            color="white" 
            style={{ marginRight: 10 }}
          />
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 14, letterSpacing: 0.5 }}>
            {toastMessage}
          </Text>
        </Animated.View>
      )}
      <FloatingChatButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  imageContainer: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productInfo: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  category: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  oldPrice: {
    fontSize: 14,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  discountBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  discountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#458B00',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addToCartText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    width: 44,
    height: 44,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    width: '80%',
  },
  shopButton: {
    flexDirection: 'row',
    backgroundColor: '#458B00', // Брендовый цвет
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 12, // Как в профиле
    alignItems: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
