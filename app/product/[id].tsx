import { FloatingChatButton } from '@/components/FloatingChatButton';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, SafeAreaView, ScrollView, Share, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logViewItem } from '../../src/utils/analytics';
import { useFavoritesStore } from '../../store/favoritesStore';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import { getImageUrl } from '../utils/image';

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addToCart, items: cartItems } = useCart();
  const { products } = useOrders();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const insets = useSafeAreaInsets();

  // Расчет реального количества товаров в корзине
  const cartCount = cartItems.reduce((total, item) => total + (item.quantity || 1), 0);

  // Состояние для карусели изображений
  const [activeImage, setActiveImage] = useState(0);
  const { width: screenWidth } = Dimensions.get('window');

  // Состояние для анимации хедера при скролле
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isScrolled, setIsScrolled] = useState(false);
  
  const [product, setProduct] = useState<any>(null);
  const [activeVariant, setActiveVariant] = useState<any>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  
  // Новые состояния для табов
  const [activeTab, setActiveTab] = useState('description');
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tabsScrollViewRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<{[key: string]: number}>({});

  // Функция для обработки скролла карусели
  const handleCarouselScroll = (event: any) => {
    const slideWidth = screenWidth;
    const currentIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActiveImage(currentIndex);
  };

  // Функция для переключения избранного
  const handleToggleFavorite = () => {
    if (!product?.id) return; // Защита от undefined/null
    
    try {
      toggleFavorite({
        id: product.id,
        name: product.name || '',
        price: product.price || 0,
        image: product.image || product.picture || product.image_url || '',
        category: product.category,
        old_price: product.old_price,
        badge: product.badge,
        unit: product.unit
      });
      
      // Показываем toast - проверяем состояние ПОСЛЕ изменения
      const isNowFavorite = favorites.some(fav => fav.id === product.id);
      showToast(isNowFavorite ? "Видалено з обраного" : "Додано в обране ❤️");
    } catch (error) {
      console.error('Error toggling favorite:', error);
      showToast('Помилка при роботі з обраним');
    }
  };

  // Функция для показа toast
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    
    // Анимация появления
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
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
    });
  };

  // Функция для обработки скролла
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  // Анимация прозрачности хедера
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0.7, 1], // От 70% до 100% прозрачности
    extrapolate: 'clamp'
  });

  // Анимация границы хедера
  const headerBorderWidth = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1], // От 0 до 1px границы
    extrapolate: 'clamp'
  });
  const handleTabPress = useCallback((tabKey: string) => {
    setActiveTab(tabKey);
    
    // Используем сохраненные координаты для точного скролла
    const xPosition = tabLayouts.current[tabKey] || 0;
    // Скроллим так, чтобы вкладка была немного левее центра
    tabsScrollViewRef.current?.scrollTo({ 
      x: Math.max(0, xPosition - 50), 
      animated: true 
    });
  }, []);

  // 1. Поиск товара
  useEffect(() => {
    if (products.length > 0 && id) {
      const found = products.find((p: any) => p.id?.toString() === id?.toString());
      if (found) {
        setProduct(found);
        setCurrentPrice(found.price || 0);
        setActiveTab('description'); // Сброс вкладки при смене товара
        
        // Отправка события просмотра товара в аналитику
        logViewItem(found).catch((error) => {
          console.error('Error logging view item:', error);
        });
      }
    }
  }, [products, id]);

  // 2. Подготовка вариантов (Нормализация данных)
  const variants = useMemo(() => {
    if (!product) return [];
    
    // Пытаемся достать variants
    let data = product.variants;
    
    // Если пришли строкой
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return [];
      }
    }
    
    const result = Array.isArray(data) ? data : [];
    return result;
  }, [product?.variants]);

  // 3. Матричный выбор вариантов (Matrix Selector)
  const matrixOptions = useMemo(() => {
    if (!product || variants.length === 0) return null;
    
    // Безопасная проверка option_names
    const hasOptionNames = product.option_names && 
                          typeof product.option_names === 'string' && 
                          product.option_names.trim().length > 0;
    
    if (!hasOptionNames) return null;
    
    // Парсим названия опций (заголовки секций)
    const optionNames = product.option_names.split('|').map(name => name.trim());
    
    // Создаем матрицу: массив массивов уникальных значений для каждой позиции
    const matrix: string[][] = [];
    
    optionNames.forEach((name, index) => {
      const uniqueValues: string[] = [];
      
      // Собираем уникальные значения для этой позиции из всех вариантов
      variants.forEach(variant => {
        // Поддерживаем оба формата: variant.name (новый) и variant.size (старый)
        const variantName = variant.name || variant.size;
        
        // Безопасная проверка
        if (!variantName || typeof variantName !== 'string') {
          return;
        }
        
        const parts = variantName.split('|').map(part => part.trim());
        
        const value = parts[index] ? parts[index].trim() : null;
        if (value && !uniqueValues.includes(value)) {
          uniqueValues.push(value);
        }
      });
      
      matrix.push(uniqueValues);
    });
    
    return {
      titles: optionNames,
      values: matrix
    };
  }, [product?.option_names, variants]);

  // 4. Поиск варианта по выбранным опциям (матрица) - ГИБКОЕ СОВПАДЕНИЕ
  const getVariantByOptions = useCallback((options: string[]) => {
    console.log('🔍 DEBUG: getVariantByOptions - входящие options:', options);
    
    // Очищаем опции от пробелов и пустых значений
    const cleanOptions = options
      .filter(opt => opt && opt.trim()) // Фильтруем пустые значения
      .map(opt => String(opt).trim()); // Преобразуем в строки и убираем пробелы
    
    console.log('🔍 DEBUG: getVariantByOptions - cleanOptions:', cleanOptions);
    
    // Если нет выбранных опций, возвращаем null
    if (cleanOptions.length === 0) {
      console.log('🔍 DEBUG: Нет выбранных опций, возвращаем null');
      return null;
    }
    
    // Ищем вариант, где ВСЕ выбранные опции присутствуют в названии
    for (const variant of variants) {
      const variantName = variant.name || variant.size;
      
      if (!variantName || typeof variantName !== 'string') {
        continue;
      }
      
      const variantParts = variantName.split('|').map(part => part.trim());
      console.log('🔍 DEBUG: Проверяем вариант:', variantParts, 'содержит ли опции:', cleanOptions);
      
      // Проверяем что все выбранные опции есть в варианте
      const hasAllOptions = cleanOptions.every(option => 
        variantParts.includes(option)
      );
      
      if (hasAllOptions) {
        console.log('✅ Успешно сопоставлено:', variantName, '-> Цена:', variant.price);
        return variant;
      }
    }
    
    console.log('🔍 DEBUG: Вариант не найден для опций:', cleanOptions);
    return null;
  }, [variants]);

  // Старая функция для совместимости (можно удалить позже)
  const findVariantByMatrix = getVariantByOptions;

  // 5. Принудительная инициализация при загрузке товара - АВТОМАТИЧЕСКИЙ ВЫБОР ПЕРВОГО ВАРИАНТА
  useEffect(() => {
    console.log('🔍 DEBUG: Загрузка товара - product:', product);
    console.log('🔍 DEBUG: Загрузка товара - variants:', variants);
    console.log('🔍 DEBUG: Загрузка товара - variants.length:', variants.length);
    
    if (product) {
      if (variants.length > 0) {
        const firstVariant = variants[0];
        console.log('🔍 DEBUG: АВТОМАТИЧЕСКИ выбираем первый вариант:', firstVariant);
        
        // Извлекаем опции из имени первого варианта
        const variantName = firstVariant.name || firstVariant.size;
        const variantOptions = variantName ? variantName.split('|').map(part => part.trim()) : [];
        
        console.log('🔍 DEBUG: Извлеченные опции из первого варианта:', variantOptions);
        
        // Устанавливаем все значения
        setActiveVariant(firstVariant);
        setCurrentPrice(firstVariant.price || 0);
        setSelectedOptions(variantOptions);
        
        console.log('🔍 DEBUG: Установлено - activeVariant:', firstVariant);
        console.log('🔍 DEBUG: Установлено - currentPrice:', firstVariant.price);
        console.log('🔍 DEBUG: Установлено - selectedOptions:', variantOptions);
      } else {
        // Если вариантов нет, используем базовую цену товара
        console.log('🔍 DEBUG: Нет вариантов, устанавливаем базовую цену:', product.price);
        setCurrentPrice(product.price || 0);
        setSelectedOptions([]);
        console.log('🔍 DEBUG: Установлено - currentPrice (базовый):', product.price || 0);
      }
    }
  }, [product?.id, variants.length]); // Добавляем variants.length для отслеживания загрузки

  // 5.1. Финальная проверка и установка цены - ИСПРАВЛЕНО
  useEffect(() => {
    if (product && !currentPrice && !activeVariant) {
      // Устанавливаем базовую цену только если нет вариантов и нет активного варианта
      const finalPrice = product.price || 0;
      console.log('🔍 DEBUG: ФИНАЛЬНАЯ установка базовой цены (нет вариантов):', finalPrice);
      setCurrentPrice(finalPrice);
    }
  }, [product?.price, currentPrice, activeVariant]);
  // useEffect(() => {
  //   if (selectedOptions.length > 0 && variants.length > 0) {
  //     const variant = getVariantByOptions(selectedOptions);
  //     
  //     if (variant && variant !== activeVariant) {
  //       console.log('🔍 DEBUG: Обновляем вариант по опциям:', variant);
  //       setActiveVariant(variant);
  //       setCurrentPrice(variant.price);
  //     } else if (!variant && activeVariant) {
  //       // Комбинация не найдена - сбрасываем активный вариант
  //       console.log('🔍 DEBUG: Комбинация не найдена, сбрасываем вариант');
  //       setActiveVariant(null);
  //     }
  //   }
  // }, [selectedOptions.join('|'), variants]); // Используем join для стабильности

  // 7. Функция для выбора опции в матрице - ИСПРАВЛЕННАЯ ВЕРСИЯ
  const handleMatrixOptionSelect = useCallback((index: number, value: string) => {
    console.log('🔍 DEBUG: Выбираем опцию - index:', index, 'value:', value, 'type:', typeof value);
    
    setSelectedOptions(prev => {
      console.log('🔍 DEBUG: Текущие selectedOptions перед изменением:', prev);
      
      const newOptions = [...(prev || [])];
      // Убеждаемся что массив правильного размера и нет undefined
      while (newOptions.length <= index) {
        newOptions.push('');
      }
      
      // Устанавливаем значение, убеждаемся что это строка
      const stringValue = String(value || '').trim();
      newOptions[index] = stringValue;
      
      console.log('🔍 DEBUG: Новые опции после выбора:', newOptions);
      console.log('🔍 DEBUG: Типы новых опций:', newOptions.map(o => typeof o));
      
      // Находим вариант по новым опциям - передаем newOptions, а не variants!
      const foundVariant = getVariantByOptions(newOptions);
      if (foundVariant) {
        console.log('🔍 DEBUG: НАЙДЕН ВАРИАНТ в handleMatrixOptionSelect:', foundVariant);
        console.log('✅ Успешно сопоставлено:', foundVariant.name || foundVariant.size, '-> Цена:', foundVariant.price);
        console.log('🔍 DEBUG: Обновляем цену на:', foundVariant.price);
        console.log('🔍 DEBUG: Обновляем activeVariant на:', foundVariant);
        setActiveVariant(foundVariant);
        setCurrentPrice(foundVariant.price); // Обновляем currentPrice
        console.log('🔍 DEBUG: Обновлен currentPrice на:', foundVariant.price);
      } else {
        console.log('🔍 DEBUG: Вариант НЕ НАЙДЕН в handleMatrixOptionSelect');
        console.log('🔍 DEBUG: Ищем по опциям:', newOptions);
        console.log('🔍 DEBUG: Доступные варианты:', variants.map(v => ({name: v.name || v.size, price: v.price})));
      }
      
      return newOptions;
    });
  }, [variants]);

  // 8. Сброс при смене товара - УДАЛЕН, так как конфликтует с инициализацией

  // Функция форматирования цены (как в модальном окне)
  const formatPrice = (price: number) => {
    const safePrice = price || 0;
    return `${safePrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  };

  // Единый массив вкладок
  const TABS = [
    { key: 'description', label: 'Опис' },
    { key: 'instruction', label: 'Інструкція та протипоказання' },
    { key: 'delivery', label: 'Доставка та оплата' },
    { key: 'return', label: 'Повернення' }
  ];

  // Функция поделиться
  const handleShare = async () => {
    if (!product) return;
    
    try {
      Vibration.vibrate(10); // Эффект дрожания при нажатии
      const shareMessage = `${product.name || 'Товар'}\n${formatPrice(currentPrice)}\n\nПереглянути товар в додатку`;
      await Share.share({
        message: shareMessage,
        title: product.name || 'Товар',
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        console.error('Error sharing:', error);
      }
    }
  };

  if (!product?.id) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#000" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Плавающий хедер с кнопками действий */}
      <Animated.View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        width: '100%',
        paddingTop: insets.top + 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: headerBorderWidth,
        borderBottomColor: '#eee',
        height: 60 + insets.top // Фиксированная высота для иконок
      }}>
        {/* Градиентный фон хедера */}
        <Animated.View 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: headerOpacity
          }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
          />
        </Animated.View>
        
        {/* BlurView для мобильных устройств, fallback для веба */}
        {typeof Platform !== 'undefined' && Platform.OS !== 'web' ? (
          <BlurView 
            intensity={50} 
            tint="light"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.5
            }}
          />
        ) : null}
        
        {/* Левая часть - кнопка назад */}
        <TouchableOpacity 
          onPress={() => router.back()}
          style={{
            width: 44,
            height: 44,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: 22,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3
          }}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>

        {/* Правая часть - группа кнопок */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20
        }}>
          {/* Корзина с бейджем */}
          <TouchableOpacity 
            onPress={() => router.push('/cart')}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3
            }}
          >
            <Ionicons name="cart-outline" size={24} color="#000" />
            {/* Бейдж с количеством товаров - показываем только если есть товары */}
            {cartCount > 0 && (
              <View style={{
                position: 'absolute',
                right: -8,
                top: -8,
                backgroundColor: '#e74c3c',
                borderRadius: 12,
                minWidth: 24,
                height: 24,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 'bold'
                }}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Избранное */}
          <TouchableOpacity 
            onPress={() => {
              handleToggleFavorite();
              Vibration.vibrate(10);
            }}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3
            }}
          >
            <Ionicons 
              name={favorites.some(fav => fav.id === product?.id) ? "heart" : "heart-outline"} 
              size={24} 
              color={favorites.some(fav => fav.id === product?.id) ? "#e74c3c" : "#000"} 
            />
          </TouchableOpacity>
          
          {/* Поделиться */}
          <TouchableOpacity 
            onPress={handleShare}
            style={{
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3
            }}
          >
            <Ionicons name="share-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView 
  contentContainerStyle={{ paddingBottom: 40, paddingTop: 80 + insets.top }} 
  showsVerticalScrollIndicator={false}
  onScroll={handleScroll}
  scrollEventThrottle={16}
>
        {/* 1. Карусель изображений товара */}
        <View style={{ position: 'relative' }}>
          <ScrollView
            horizontal
            pagingEnabled={true}
            showsHorizontalScrollIndicator={false}
            onScroll={handleCarouselScroll}
            scrollEventThrottle={16}
            style={{ width: screenWidth }}
          >
            {product && (() => {
              // Логика данных: создаем массив изображений
              const images = product.images ? product.images.split(',').map((url: string) => url.trim()) : [product.image || product.picture || product.image_url];
              
              return images.map((imageUrl: string, index: number) => (
                <Image
                  key={index}
                  source={{ uri: getImageUrl(imageUrl) }}
                  style={{
                    width: screenWidth,
                    height: 300,
                    backgroundColor: '#f5f5f5'
                  }}
                  resizeMode="cover"
                />
              ));
            })()}
          </ScrollView>
          
          {/* Индикаторы (Dots) */}
          {product && (() => {
            const images = product.images ? product.images.split(',').map((url: string) => url.trim()) : [product.image || product.picture || product.image_url];
            if (images.length > 1) {
              return (
                <View style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 0,
                  right: 0,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8
                }}>
                  {images.map((_: any, index: number) => (
                    <View
                      key={index}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: index === activeImage ? '#000' : 'rgba(255,255,255,0.5)'
                      }}
                    />
                  ))}
                </View>
              );
            }
            return null;
          })()}
        </View>

        {/* 2. Информация о товаре */}
        <View style={{ padding: 20 }}>
          {/* Название товара */}
          <Text style={{ 
            fontSize: 24, 
            fontWeight: 'bold', 
            color: '#111827',
            lineHeight: 30,
            marginBottom: 8 
          }}>
            {product.name}
          </Text>

          {/* Строка "Статус + Рейтинг" */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16 
          }}>
            {/* Слева: Статус */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={{ fontSize: 14, color: '#16A34A', fontWeight: '500' }}>
                Є в наявності
              </Text>
            </View>

            {/* Справа: Рейтинг */}
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={() => {
                // TODO: Открыть экран с отзывами
                console.log('Open reviews');
              }}
            >
              <View style={{ flexDirection: 'row', gap: 1 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons 
                    key={star} 
                    name="star" 
                    size={16} 
                    color={star <= 4 ? '#FBBF24' : '#E5E7EB'} 
                  />
                ))}
              </View>
              <Text style={{ fontSize: 14, color: '#6B7280' }}>
                4.8 (142)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Блок Цены */}
          <View style={{ marginBottom: 20 }}>
            {(() => {
              // 1. Вычисляем эффективную скидку (один раз для товара)
              let discountPercent = 0;
              
              // Приоритет: поле discount из БД
              if (product.discount && product.discount > 0) {
                discountPercent = product.discount;
              } 
              // Fallback: вычисляем из базовых цен old_price > price
              else if (product.old_price && product.old_price > (product.price || 0)) {
                discountPercent = Math.round((1 - (product.price || 0) / product.old_price) * 100);
              }

              // 2. Вычисляем старую цену для текущего варианта
              const currentPriceValue = activeVariant ? activeVariant.price : (currentPrice || product.price || 0); // ОБЯЗАТЕЛЬНО берем цену из activeVariant
              console.log('🔍 DEBUG: Отображение цены - currentPrice:', currentPrice);
              console.log('🔍 DEBUG: Отображение цены - activeVariant:', activeVariant);
              console.log('🔍 DEBUG: Отображение цены - activeVariant.price:', activeVariant?.price);
              console.log('🔍 DEBUG: Отображение цены - product.price:', product.price);
              console.log('🔍 DEBUG: Отображение цены - currentPriceValue:', currentPriceValue);
              
              let dynamicOldPrice = null;
              
              // Используем old_price из выбранного варианта или из товара
              const variantOldPrice = (activeVariant && activeVariant.old_price) || product.old_price;
              if (variantOldPrice && variantOldPrice > currentPriceValue) {
                dynamicOldPrice = variantOldPrice;
              } else if (discountPercent > 0) {
                dynamicOldPrice = Math.round(currentPriceValue * 100 / (100 - discountPercent));
              }

              // 3. Рендер на основе эффективной скидки
              return (
                <View style={{ minHeight: 60, justifyContent: 'center' }}>
                  {(dynamicOldPrice && dynamicOldPrice > currentPriceValue) ? (
                    /* Сценарий со скидкой */
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                      {/* Текущая цена варианта */}
                      <Text style={{ 
                        color: '#DC2626', 
                        fontSize: 32, 
                        fontWeight: 'bold'
                      }}>
                        {formatPrice(currentPriceValue)}
                      </Text>
                  
                  {/* Динамическая старая цена для этого варианта */}
                  <Text style={{ 
                    color: '#9CA3AF', 
                    fontSize: 18,
                    textDecorationLine: 'line-through',
                    marginBottom: 4
                  }}>
                    {formatPrice(dynamicOldPrice)}
                  </Text>
                  
                  {/* Бейдж скидки */}
                  <View style={{
                    backgroundColor: '#FEE2E2',
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    marginBottom: 4
                  }}>
                    <Text style={{
                      color: '#DC2626',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}>
                      -{discountPercent}%
                    </Text>
                  </View>
                </View>
              ) : (
                /* Сценарий обычной цены */
                <Text style={{ 
                  color: '#111827', 
                  fontSize: 32, 
                  fontWeight: 'bold'
                }}>
                  {formatPrice(currentPriceValue)}
                </Text>
              )}
                </View>
              );
            })()}
          </View>

          {/* 3. Матричный выбор вариантов (если есть) */}
          {matrixOptions && matrixOptions.titles && matrixOptions.titles.length > 0 ? (
            <>
              {matrixOptions.titles.map((title, sectionIndex) => (
                <View key={sectionIndex} style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#333' }}>
                    {title}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    {matrixOptions.values[sectionIndex] && matrixOptions.values[sectionIndex].map((value, valueIndex) => {
                      const isSelected = selectedOptions && selectedOptions[sectionIndex] === value;
                      
                      return (
                        <TouchableOpacity
                          key={valueIndex}
                          onPress={() => handleMatrixOptionSelect(sectionIndex, value)}
                          style={{
                            minWidth: 60, 
                            height: 44, 
                            borderRadius: 22,
                            borderWidth: 2,
                            borderColor: isSelected ? '#000' : '#333',
                            backgroundColor: isSelected ? '#000' : '#fff',
                            alignItems: 'center', 
                            justifyContent: 'center',
                            paddingHorizontal: 16,
                            marginBottom: 4
                          }}
                        >
                          <Text style={{ 
                            color: isSelected ? '#fff' : '#000', 
                            fontWeight: '700',
                            fontSize: 16
                          }}>
                            {value || '???'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </>
          ) : (
            // Старая логика для обратной совместимости
            variants.length > 0 && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                  <Text>Фасування (</Text>
                  <Text>{product.unit || 'шт'}</Text>
                  <Text>)</Text>
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
                  {variants.map((v: any, idx: number) => {
                    const isActive = activeVariant?.size === v.size;
                    const label = `${v.size} ${product.unit || ''}`;
                    
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => { 
                          setActiveVariant(v);
                          setCurrentPrice(v.price);
                        }}
                        style={{ 
                          backgroundColor: isActive ? '#000' : '#f5f5f5',
                          borderWidth: 1,
                          borderColor: isActive ? '#000' : '#ddd',
                          borderRadius: 8,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: isActive ? 'white' : 'black', fontWeight: 'bold' }}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )
          )}

          {/* Информация о выбранном варианте */}
          {((matrixOptions && selectedOptions.length > 0) || (!matrixOptions && activeVariant)) && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
                Обрано: <Text style={{ fontWeight: '600', color: '#333' }}>
                  {matrixOptions ? selectedOptions.join(' | ') : (activeVariant?.size || activeVariant?.option_values?.join(' | ') || '1 шт')}
                </Text>
              </Text>
            </View>
          )}

          {/* 4. Кнопка покупки */}
          <TouchableOpacity 
            onPress={() => {
              if (!product || !product.id) {
                console.error('❌ Некорректный товар:', product);
                showToast('Помилка: товар не знайдено');
                return;
              }
              
              console.log('🛒 Добавляю в корзину из карточки товара:', product.name);
              
              try {
                if (matrixOptions && selectedOptions.length > 0) {
                  // Матричный выбор - используем выбранные опции
                  const variantName = selectedOptions.join(' | ');
                  const selectedVariant = activeVariant || variants[0];
                  
                  console.log('📦 Добавляем матричный вариант:', variantName, 'цена:', selectedVariant.price);
                  
                  // Создаем объект товара с вариантом и правильным названием
                  const productWithVariant = {
                    ...product,
                    name: `${product.name} (${selectedOptions.join(', ')})`, // Добавляем характеристики к названию
                    selectedVariant: variantName,
                    variantPrice: selectedVariant.price
                  };
                  
                  addToCart(productWithVariant, 1, variantName, product.unit || 'шт', selectedVariant.price);
                } else if (activeVariant) {
                  // Простой вариант (без матрицы)
                  const variantName = activeVariant.size || activeVariant.name || '1 шт';
                  
                  console.log('📦 Добавляем простой вариант:', variantName, 'цена:', activeVariant.price);
                  
                  // Создаем объект товара с вариантом и правильным названием
                  const productWithVariant = {
                    ...product,
                    name: `${product.name} (${variantName})`, // Добавляем характеристики к названию
                    selectedVariant: variantName,
                    variantPrice: activeVariant.price
                  };
                  
                  addToCart(productWithVariant, 1, variantName, product.unit || 'шт', activeVariant.price);
                } else if (variants.length > 0) {
                  // Есть варианты но не выбраны (fallback)
                  const firstVariant = variants[0];
                  const variantName = firstVariant.size || firstVariant.option_values?.join(' | ') || '1 шт';
                  
                  console.log('📦 Добавляем первый вариант (fallback):', variantName, 'цена:', firstVariant.price);
                  
                  const productWithVariant = {
                    ...product,
                    selectedVariant: variantName,
                    variantPrice: firstVariant.price
                  };
                  
                  addToCart(productWithVariant, 1, variantName, product.unit || 'шт', firstVariant.price);
                } else {
                  // Базовый товар без вариантов
                  console.log('📦 Добавляем базовый товар, цена:', currentPrice || product.price);
                  addToCart(product, 1, product.weight || product.unit || 'шт', product.unit || 'шт', currentPrice || product.price);
                }
                
                console.log('✅ Товар успешно добавлен в корзину');
                showToast('Товар додано в кошик');
              } catch (error) {
                console.error('❌ Ошибка при добавлении в корзину:', error);
                showToast('Помилка при додаванні в кошик');
              }
            }}
              style={{ 
                backgroundColor: 'black', 
                borderRadius: 10, 
                paddingVertical: 16, 
                alignItems: 'center',
                marginBottom: 20
              }}
              disabled={false} // Всегда активна - мы гарантируем что вариант выбран
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                В кошик
              </Text>
            </TouchableOpacity>
          </View>

          {/* 5. Преимущества */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, backgroundColor: '#f9f9f9', padding: 15, borderRadius: 12 }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Ionicons name="shield-checkmark" size={20} color="#4CAF50" style={{ marginBottom: 5 }} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#555' }}>100% Оригінал</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Ionicons name="rocket" size={20} color="#2E7D32" style={{ marginBottom: 5 }} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#555' }}>Швидка доставка</Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Ionicons name="calendar" size={20} color="#FF9800" style={{ marginBottom: 5 }} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#555' }}>Свіжі терміни</Text>
            </View>
          </View>

          {/* РАЗДЕЛИТЕЛЬ */}
          <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 10 }} />

          {/* 6. ЕДИНАЯ ЛЕНТА ВКЛАДОК */}
          <View style={{ position: 'relative', marginBottom: 15 }}>
            <ScrollView 
              ref={tabsScrollViewRef}
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={{ minHeight: 50 }}
              contentContainerStyle={{ 
                alignItems: 'center', 
                paddingHorizontal: 20,
                gap: 15 // Используем gap вместо marginRight
              }}
            >
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => handleTabPress(tab.key)}
                  onLayout={(event) => { 
                    tabLayouts.current[tab.key] = event.nativeEvent.layout.x; 
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 2,
                    borderBottomColor: activeTab === tab.key ? '#000' : '#E5E7EB',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{ 
                    fontSize: 14, 
                    fontWeight: activeTab === tab.key ? '600' : '400',
                    color: activeTab === tab.key ? '#000' : '#666',
                    textAlign: 'center'
                  }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Градиентное затухание справа */}
            <View 
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 40,
                backgroundColor: 'rgba(255,255,255,0.8)',
                shadowColor: '#000',
                shadowOffset: { width: -2, height: 0 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 1
              }}
              pointerEvents="none"
            />
            <View 
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 20,
                backgroundColor: 'rgba(255,255,255,0.95)',
              }}
              pointerEvents="none"
            />
            <View 
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 10,
                backgroundColor: 'white',
              }}
              pointerEvents="none"
            />
          </View>
          
          {/* Контент вкладок */}
          <View style={{ marginBottom: 30, minHeight: 80 }}>
            {activeTab === 'description' && (
              <View style={{ paddingHorizontal: 16 }}>
                <Text style={{ color: '#333', lineHeight: 24, fontSize: 15 }}>
                  {product.description || ''}
                </Text>
              </View>
            )}
            {activeTab === 'instruction' && (
              <View style={{ paddingHorizontal: 16 }}>
                <Text style={{ color: '#333', lineHeight: 24, fontSize: 15, marginBottom: 16 }}>
                  {product.usage || ''}
                </Text>
                <Text style={{ color: '#333', lineHeight: 24, fontSize: 15 }}>
                  {product.composition || ''}
                </Text>
              </View>
            )}
            {activeTab === 'delivery' && (
              <View style={{ paddingHorizontal: 16 }}>
                <Text style={{ color: '#333', lineHeight: 24, fontSize: 15, marginBottom: 16 }}>
                  {product.delivery_info || ''}
                </Text>
                <Text style={{ color: '#333', lineHeight: 24, fontSize: 15 }}>
                  {product.payment_info || ''}
                </Text>
              </View>
            )}
            {activeTab === 'return' && (
              <View style={{ paddingHorizontal: 16 }}>
                <Text style={{ color: '#333', lineHeight: 24, fontSize: 15 }}>
                  {product.return_info || ''}
                </Text>
              </View>
            )}
          </View>

          {/* 7. Похожие товары */}
          {(() => {
            // Фильтруем товары той же категории, исключая текущий товар
            const similarProducts = products.filter((p: any) => 
              p.category === product?.category && 
              p.id !== product?.id
            ).slice(0, 10); // Ограничиваем до 10 товаров

            if (similarProducts.length === 0 || !product?.category) return null;

            return (
              <View style={{ marginTop: 20, marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 20 }}>
                  Схожі товари
                </Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                >
                  {similarProducts.map((item: any, idx: number) => (
                    <TouchableOpacity
                      key={item.id || idx}
                      onPress={() => router.push(`/product/${item.id}`)}
                      style={{ 
                        width: 140, 
                        marginRight: 15,
                        backgroundColor: 'white',
                        borderRadius: 12,
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      <Image 
                        source={{ uri: getImageUrl(item.picture || item.image || item.image_url) }} 
                        style={{ 
                          width: '100%', 
                          height: 140, 
                          borderRadius: 12,
                          backgroundColor: '#f0f0f0',
                          marginBottom: 8
                        }}
                        resizeMode="cover"
                      />
                      <View style={{ padding: 10 }}>
                        <Text 
                          numberOfLines={2} 
                          style={{ 
                            fontSize: 13, 
                            fontWeight: '600', 
                            marginBottom: 6,
                            minHeight: 36
                          }}
                        >
                          {item.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {item.old_price && item.old_price > item.price && (
                            <Text style={{ 
                              textDecorationLine: 'line-through', 
                              color: '#999', 
                              fontSize: 11 
                            }}>
                              {formatPrice(item.old_price)}
                            </Text>
                          )}
                          <Text style={{ 
                            fontSize: 15, 
                            fontWeight: 'bold', 
                            color: item.old_price && item.old_price > item.price ? '#e74c3c' : '#000'
                          }}>
                            {formatPrice(item.price)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          })()}

          {/* 8. Відгуки */}
          <View style={{ marginTop: 32, paddingHorizontal: 20, paddingBottom: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#111827' }}>
              Відгуки покупців
            </Text>
            
            {(() => {
              const REVIEWS = [
                { id: 1, author: 'Олександр К.', date: '12.01.2025', rating: 5, text: 'Гриби супер, якість на висоті! Відчуваю покращення концентрації вже через тиждень. Сервіс також порадував.' },
                { id: 2, author: 'Ірина М.', date: '10.01.2025', rating: 5, text: 'Швидка доставка, гарне пакування. Інструкція дуже допомогла розібратися з дозуванням. Дякую!' },
                { id: 3, author: 'Дмитро', date: '05.01.2025', rating: 4, text: 'Товар якісний, все сподобалось. Єдине зауваження - хотілося б більше варіантів фасування.' }
              ];

              return REVIEWS.map((review) => (
                <View 
                  key={review.id} 
                  style={{ 
                    borderBottomWidth: 1, 
                    borderBottomColor: '#F3F4F6', 
                    paddingVertical: 16,
                    marginBottom: 0 
                  }}
                >
                  {/* Шапка отзыва */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    {/* Имя с аватаром */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: '#F3F4F6', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>
                          {review.author.charAt(0)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                        {review.author}
                      </Text>
                    </View>
                    
                    {/* Дата */}
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {review.date}
                    </Text>
                  </View>

                  {/* Рейтинг */}
                  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons 
                        key={star} 
                        name="star" 
                        size={14} 
                        color={star <= review.rating ? '#FBBF24' : '#E5E7EB'} 
                        style={{ marginRight: 2 }}
                      />
                    ))}
                  </View>

                  {/* Текст отзыва */}
                  <Text style={{ 
                    fontSize: 15, 
                    color: '#4B5563', 
                    lineHeight: 22,
                    marginBottom: 8
                  }}>
                    {review.text}
                  </Text>
                </View>
              ));
            })()}

            {/* Кнопка "Написати відгук" */}
            <TouchableOpacity 
              style={{
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                marginTop: 16,
                backgroundColor: 'white'
              }}
              onPress={() => {
                // TODO: Открыть форму отзыва
                console.log('Open review form');
              }}
            >
              <Text style={{ 
                color: '#111827', 
                fontSize: 16, 
                fontWeight: '500' 
              }}>
                Написати відгук
              </Text>
            </TouchableOpacity>
          </View>
      </ScrollView>

      {/* Toast уведомление */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 120,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 99999,
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0]
              })
            }]
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(30, 30, 30, 0.95)',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 50,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 10,
            }}
          >
            <Ionicons 
              name={toastMessage.includes('Видалено') ? "trash-outline" : "checkmark-circle"} 
              size={20} 
              color="white" 
              style={{ marginRight: 10 }} 
            />
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
              {toastMessage}
            </Text>
          </View>
        </Animated.View>
      )}
      
      {/* Floating Chat Button */}
      <FloatingChatButton bottomOffset={120} />
    </SafeAreaView>
  );
}
