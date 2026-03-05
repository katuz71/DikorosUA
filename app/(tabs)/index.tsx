import { FloatingChatButton } from '@/components/FloatingChatButton';
import ProductCardSmall from '@/components/ProductCardSmall';
import { Colors } from '@/constants/theme';
import { API_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useCategories } from '@/context/CategoriesContext';
import { useOrders } from '@/context/OrdersContext';
import { getImageUrl } from '@/utils/image';
import { getHistory } from '@/app/utils/history';
import { logAddToCart } from '../../src/utils/analytics';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from 'expo-image';
import { ActivityIndicator, Animated, Dimensions, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from "react-native";

type Product = {
  id: number;
  name: string;
  price: number;
  minPrice?: number;
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
  pack_sizes?: string[] | string;
  old_price?: number;
  unit?: string;
  delivery_info?: string;
  return_info?: string;
  option_names?: string | null;
  variants?: any[];
  variationGroups?: any[];
  is_bestseller?: boolean;
  is_promotion?: boolean;
  is_new?: boolean;
};

// BannerImage component for handling banner images with error fallback
const BannerImage = ({ uri, width, height }: { uri: string; width: number; height: number }) => {
  const [error, setError] = useState(false);
  const [useProxy, setUseProxy] = useState(true);

  const trimmed = (uri || '').trim();

  // Direct URL (no resizer)
  const originalUri = trimmed ? getImageUrl(trimmed) : getImageUrl(null);

  // Proxy URL (backend resizer). Some environments may not have it deployed yet.
  const proxyUri = trimmed
    ? getImageUrl(trimmed, { width: Math.round(width * 2), height: Math.round(height * 2), quality: 80, format: 'jpg' })
    : getImageUrl(null);

  const activeUri = useProxy ? proxyUri : originalUri;

  // If banner URI changes (e.g. cache -> fresh), allow retry.
  useEffect(() => {
    setError(false);
    setUseProxy(true);
  }, [proxyUri, originalUri]);
  
  const BANNER_GAP = 24;
  const BANNER_RADIUS = 12;

  if (error) {
    // Fallback UI (Placeholder)
    return (
      <View style={{
        width,
        height,
        backgroundColor: '#f5f5f5',
        borderRadius: BANNER_RADIUS,
        marginRight: BANNER_GAP,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <Ionicons name="image-outline" size={40} color="#ccc" />
      </View>
    );
  }
  
  return (
    <Image 
      source={{ uri: activeUri }} 
      style={{ 
        width,
        height, 
        borderRadius: BANNER_RADIUS,
        marginRight: BANNER_GAP,
        backgroundColor: '#f5f5f5',
        overflow: 'hidden',
      }} 
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={(e) => {
        const msg = (e as any)?.nativeEvent?.error ?? (e as any)?.message;
        const msgText = typeof msg === 'string' ? msg : '';
        console.error("❌ Banner image failed to load:", activeUri, msgText ? `(${msgText})` : '');

        // If backend resizer isn't deployed (404), retry with the original URL.
        if (useProxy && (msgText.includes('code=404') || msgText.includes(' 404') || msgText.includes('HTTP 404'))) {
          setUseProxy(false);
          return;
        }

        setError(true);
      }}
      onLoad={() => {
        // Image loaded successfully
      }}
    />
  );
};

export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addItem, items: cartItems } = useCart();
  const { categories } = useCategories();
  const { products, isLoading, fetchProducts } = useOrders();

  const formatPrice = (price: number) => {
    const safePrice = price || 0;
    return `${safePrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  };

  const cart = cartItems;
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Всі");
  const [successVisible, setSuccessVisible] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [banners, setBanners] = useState<any[]>([]);
  const [viewedHistory, setViewedHistory] = useState<Product[]>([]);
  const [connectionError, setConnectionError] = useState(false);
  const [posts, setPosts] = useState<{ id: number; title: string; image_url?: string; created_at?: string }[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const safeProducts = Array.isArray(products) ? products : [];
  const bestsellers = useMemo(() => safeProducts.filter((p: Product) => !!p.is_bestseller), [safeProducts]);
  const promotions = useMemo(() => safeProducts.filter((p: Product) => !!p.is_promotion), [safeProducts]);
  const newProducts = useMemo(() => safeProducts.filter((p: Product) => !!p.is_new), [safeProducts]);

  // Список для чипів: "Всі" (id = null) + категорії з бекенду
  const categoryChips = useMemo(() => {
    const all: { id: number | null; name: string; banner_url?: string; banners?: string[] }[] = [{ id: null, name: 'Всі' }];
    categories.forEach((cat) => all.push({ id: cat.id, name: cat.name, banner_url: cat.banner_url, banners: cat.banners }));
    return all;
  }, [categories]);

  const loadViewedHistory = useCallback(() => {
    getHistory().then((list) => setViewedHistory(list || []));
  }, []);
  useEffect(() => loadViewedHistory(), [loadViewedHistory]);
  useFocusEffect(loadViewedHistory);

  const loadBanners = useCallback(async () => {
    const CACHE_KEY = 'cached_banners_v2'; // Новый ключ кэша
    
    try {
      // STEP 1: Сначала загружаем из кэша (если есть) и показываем сразу
      try {
        const cachedData = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedData) {
          try {
            const cachedBanners = JSON.parse(cachedData);
            if (Array.isArray(cachedBanners) && cachedBanners.length > 0) {
              // Используем оптимизированные данные из кэша как есть
              setBanners(cachedBanners); // Показываем кэшированные баннеры сразу
            }
          } catch (parseError) {
            // Очищаем поврежденный кэш
            await AsyncStorage.removeItem(CACHE_KEY);
          }
        }
      } catch (cacheError) {
        // Ignore cache errors
      }

      // STEP 2: Затем загружаем свежие данные с API
      const bannersUrl = `${API_URL}/banners`;
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 10000); // Уменьшили timeout до 10 секунд
      
      const bannerRes = await fetch(bannersUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller2.signal,
      });
      
      clearTimeout(timeout2);
      if (bannerRes.ok) {
        const bannersData = await bannerRes.json();
        const bannersArray = Array.isArray(bannersData) ? bannersData : [];
        if (bannersArray.length > 0) {
          // Ограничиваем количество баннеров для экономии памяти и кэша
          const limitedBanners = bannersArray.slice(0, 3);
          
          // STEP 3: Обновляем состояние свежими данными
          setBanners(limitedBanners);
          
          // STEP 4: Сохраняем в кэш для следующего раза с оптимизацией
          try {
            // Создаем оптимизированную версию для кэша (только необходимые поля)
            const optimizedBanners = limitedBanners.map(banner => ({
              id: banner.id,
              image_url: banner.image_url || banner.image || banner.picture,
              title: banner.title || '',
              link: banner.link || ''
            }));
            
            const dataToCache = JSON.stringify(optimizedBanners);
            // Проверяем размер данных перед сохранением
            if (dataToCache.length < 3000) { // Уменьшили ограничение до ~3KB
              await AsyncStorage.setItem(CACHE_KEY, dataToCache);
            }
          } catch (saveError) {
            // Не прерываем работу, просто не сохраняем в кэш
          }
        }
      }
    } catch (bannerError: any) {
      // Не очищаем баннеры при ошибке - оставляем кэшированные данные
    }
  }, [API_URL]);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  const POSTS_URL = 'http://80.209.231.210:8000/posts';
  useEffect(() => {
    let cancelled = false;
    setPostsLoading(true);
    fetch(POSTS_URL, { method: 'GET', headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setPosts(data);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Обработка параметра для открытия профиля после заказа
  useEffect(() => {
    if (params.showProfile === 'true') {
      // Небольшая задержка для плавного перехода
      const timer = setTimeout(() => {
        router.push('/(tabs)/profile');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [params.showProfile]);

  // Set initial selectedSize when product is selected
  // Legacy useEffect for selectedSize removed to avoid conflicts and errors with string pack_sizes
  const [aiVisible, setAiVisible] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: 'Привіт! Я експерт із сили природи. Допоможу підібрати гриби, вітаміни чи трави для твого здоров\'я. Що шукаємо? 🌿🍄', sender: 'bot' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const chatFlatListRef = useRef<FlatList>(null);
  const bannerRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);

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


  const CHAT_API_URLS = [`${API_URL}/chat`, `${API_URL}/api/chat`];

  const sendMessage = async () => {
    if (!inputMessage.trim() || isChatLoading) return;

    const userMessage = inputMessage.trim();
    const userMsg = { id: Date.now(), text: userMessage, sender: 'user' };
    
    // Добавляем сообщение пользователя
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsChatLoading(true);
    
    // Скроллим после добавления сообщения пользователя
    setTimeout(() => {
      chatFlatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Формируем историю для отправки
    const history = updatedMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
    
    // Отправляем запрос
    try {
      let data: any = null;
      let lastStatus: number | null = null;
      for (const url of CHAT_API_URLS) {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: history }),
        });

        lastStatus = response.status;
        if (!response.ok) {
          if (response.status === 404) continue;
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        data = await response.json();
        break;
      }

      if (!data) {
        if (lastStatus === 404) throw new Error('CHAT_ENDPOINT_NOT_FOUND');
        throw new Error('No response from chat endpoint');
      }
      const replyText = data.text || data.response || 'Вибачте, не вдалося отримати відповідь.';
      const recommendedProducts = data.products || [];
      
      const botMsg = { 
        id: Date.now() + 1, 
        text: replyText, 
        sender: 'bot',
        products: recommendedProducts
      };
      
      // Добавляем ответ бота
      setMessages(prev => [...prev, botMsg]);
      
      // Скроллим после получения ответа
      setTimeout(() => {
        chatFlatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      Vibration.vibrate(50);
      setIsChatLoading(false);
    } catch (error) {
      console.error('Error calling API:', error);
      const errorMsg = { 
        id: Date.now() + 1, 
        text: (error as any)?.message === 'CHAT_ENDPOINT_NOT_FOUND'
          ? 'Чат тимчасово недоступний на сервері (ендпоінт /chat не знайдено).'
          : 'Вибачте, не вдалося підключитися до сервера. Перевірте, чи запущений сервер.', 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMsg]);
      setIsChatLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  const BANNER_GAP = 24;

  // Auto-scrolling banner carousel
  useEffect(() => {
    if (banners.length === 0) return;
    
    const { width } = Dimensions.get('window');
    const CARD_WIDTH = width - 40;
    const TOTAL_WIDTH = CARD_WIDTH + BANNER_GAP;
    
    const interval = setInterval(() => {
      setBannerIndex(prev => {
        const next = prev === banners.length - 1 ? 0 : prev + 1;
        const scrollPosition = next * TOTAL_WIDTH;
        bannerRef.current?.scrollTo({ x: scrollPosition, animated: true });
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [banners]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Image
            source={require('../../assets/images/logo.png')}
            style={{ width: 120, height: 40 }}
            contentFit="contain"
          />
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity 
            onPress={() => setIsSearchVisible(!isSearchVisible)}
            style={{ marginRight: 12, position: 'relative' }}
          >
            <Ionicons name="search" size={24} color="black" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/favorites')}
            style={{ marginRight: 12, position: 'relative' }}
          >
            <Ionicons name="heart" color="red" size={24} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginRight: 12, position: 'relative' }} 
            onPress={() => router.push('/(tabs)/cart')}
          >
            <Ionicons name="cart" size={26} color="black" />
            {cart.length > 0 && (
              <View style={{
                position: 'absolute',
                right: -8,
                top: -5,
                backgroundColor: 'red',
                borderRadius: 12,
                minWidth: 22,
                height: 22,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 6,
                ...(Platform.OS === 'ios' ? { zIndex: 10 } : null),
                borderWidth: 2,
                borderColor: 'white'
              }}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>
                  {cart.reduce((sum: number, item: Product) => sum + (item.quantity || 1), 0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {isSearchVisible && (
        <View style={{ paddingHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            placeholder="Пошук..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              backgroundColor: '#f0f0f0',
              padding: 10,
              borderRadius: 10,
              fontSize: 16,
              flex: 1,
              marginRight: 10
            }}
            autoFocus={true}
          />
          <TouchableOpacity
            onPress={() => {
              setIsSearchVisible(false);
              setSearchQuery('');
            }}
            style={{ padding: 8 }}
          >
            <Ionicons name="close" size={24} color="black" />
          </TouchableOpacity>
        </View>
      )}

      {connectionError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100, paddingHorizontal: 20 }}>
          <Ionicons name="cloud-offline-outline" size={64} color="#ff6b6b" />
          <Text style={{ marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
            Не вдалося підключитися до сервера
          </Text>
          <Text style={{ marginTop: 10, fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 }}>
            Перевірте підключення до інтернету та спробуйте ще раз.
          </Text>
          <TouchableOpacity
            onPress={async () => {
              setConnectionError(false);
              await fetchProducts();
            }}
            style={{
              marginTop: 20,
              backgroundColor: '#000',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Спробувати ще раз</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 }}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={{ marginTop: 10, color: '#666' }}>Завантаження товарів...</Text>
        </View>
      ) : (
        <ScrollView
          ref={mainScrollRef}
          style={styles.mainScroll}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.tint]}
            />
          }
        >
          {/* CATEGORIES — над баннерами: "Всі" фільтр на головній, інші — перехід на сторінку категорії */}
          <View style={styles.categoriesList}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingRight: 20 }}
            >
              {categoryChips.map((cat, index) => (
                <TouchableOpacity
                  key={cat.id ?? 'all'}
                  onPress={() => {
                    if (cat.id === null) {
                      if (selectedCategory !== 'Всі') Vibration.vibrate(10);
                      setSelectedCategory('Всі');
                    } else {
                      console.log('SENDING BANNERS:', cat.banners);
                      router.push({
                        pathname: '/category/[id]',
                        params: { id: String(cat.id), name: cat.name, banner_url: cat.banner_url || '', banners: JSON.stringify(cat.banners || []) },
                      });
                    }
                  }}
                  style={[
                    styles.categoryItem,
                    cat.id === null && selectedCategory === 'Всі' && styles.categoryItemActive
                  ]}
                >
                  <Text style={[
                    styles.categoryText,
                    cat.id === null && selectedCategory === 'Всі' && styles.categoryTextActive
                  ]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* BANNERS */}
          {banners.length > 0 && (() => {
            const { width } = Dimensions.get('window');
            const CARD_WIDTH = width - 40;
            return (
              <ScrollView
                ref={bannerRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                style={{ marginBottom: 20 }}
                contentContainerStyle={{ paddingLeft: 20, paddingRight: 20 }}
                snapToInterval={CARD_WIDTH + BANNER_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
              >
                {banners.map((b) => {
                  const imageUrl = b.image_url || b.image || b.picture;
                  if (!imageUrl) return null;
                  return (
                    <BannerImage
                      key={b?.id || Math.random()}
                      uri={getImageUrl(imageUrl)}
                      width={CARD_WIDTH}
                      height={220}
                    />
                  );
                })}
              </ScrollView>
            );
          })()}

          {/* Нещодавно переглянуті товари — тільки якщо є дані */}
          {viewedHistory.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Нещодавно переглянуті товари</Text>
              <FlatList
                data={viewedHistory}
                keyExtractor={(item) => item?.id?.toString() || String(Math.random())}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}
                renderItem={({ item }) => {
                  const imgPath = item?.image || item?.image_url || item?.picture || '';
                  const imgUri = imgPath ? getImageUrl(imgPath, { width: 160, height: 160, quality: 80 }) : getImageUrl(null);
                  return (
                    <TouchableOpacity
                      onPress={() => item?.id && router.push(`/product/${item.id}`)}
                      activeOpacity={0.85}
                      style={styles.recentlyViewedThumb}
                    >
                      {imgPath ? (
                        <Image
                          source={{ uri: imgUri }}
                          style={styles.recentlyViewedImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={[styles.recentlyViewedImage, styles.recentlyViewedPlaceholder]}>
                          <Ionicons name="image-outline" size={28} color="#ccc" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}

          {/* Хіти продажу */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Хіти продажу</Text>
            <FlatList
              data={bestsellers}
              keyExtractor={(item) => item?.id?.toString() || String(Math.random())}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productsListContent}
              renderItem={({ item }) => (
                <View style={styles.productCardWrapper}>
                  <ProductCardSmall
                    item={item}
                    onPress={() => item?.id && router.push(`/product/${item.id}`)}
                    onCartPress={async () => {
                      Vibration.vibrate(10);
                      addItem(item, 1, item.unit || 'шт');
                      try { await logAddToCart(item); } catch (_) {}
                      showToast('Товар додано в кошик');
                    }}
                    cardWidth="100%"
                    cardHeight={300}
                  />
                </View>
              )}
            />
          </View>

          {/* Акції та знижки */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Акції та знижки</Text>
            <FlatList
              data={promotions}
              keyExtractor={(item) => item?.id?.toString() || String(Math.random())}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productsListContent}
              renderItem={({ item }) => (
                <View style={styles.productCardWrapper}>
                  <ProductCardSmall
                    item={item}
                    onPress={() => item?.id && router.push(`/product/${item.id}`)}
                    onCartPress={async () => {
                      Vibration.vibrate(10);
                      addItem(item, 1, item.unit || 'шт');
                      try { await logAddToCart(item); } catch (_) {}
                      showToast('Товар додано в кошик');
                    }}
                    cardWidth="100%"
                    cardHeight={300}
                  />
                </View>
              )}
            />
          </View>

          {/* Новинки */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Новинки</Text>
            <FlatList
              data={newProducts}
              keyExtractor={(item) => item?.id?.toString() || String(Math.random())}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productsListContent}
              renderItem={({ item }) => (
                <View style={styles.productCardWrapper}>
                  <ProductCardSmall
                    item={item}
                    onPress={() => item?.id && router.push(`/product/${item.id}`)}
                    onCartPress={async () => {
                      Vibration.vibrate(10);
                      addItem(item, 1, item.unit || 'шт');
                      try { await logAddToCart(item); } catch (_) {}
                      showToast('Товар додано в кошик');
                    }}
                    cardWidth="100%"
                    cardHeight={300}
                  />
                </View>
              )}
            />
          </View>

          {/* База знаний DikorosUA */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Блог Дико-Корисно</Text>
            {postsLoading ? (
              <View style={{ paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={Colors.light.tint} />
              </View>
            ) : posts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}
              >
                {posts.map((post) => {
                  const imgUrl = post.image_url ? getImageUrl(post.image_url, { width: 280, height: 160, quality: 80 }) : getImageUrl(null);
                  const dateStr = post.created_at
                    ? new Date(post.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';
                  return (
                    <TouchableOpacity
                      key={post.id}
                      activeOpacity={0.85}
                      style={styles.blogCard}
                      onPress={() => router.push(`/blog/${post.id}`)}
                    >
                      <Image
                        source={{ uri: imgUrl }}
                        style={styles.blogCardImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                      <View style={styles.blogCardContent}>
                        <Text style={styles.blogCardTitle} numberOfLines={2}>{post.title}</Text>
                        {dateStr ? <Text style={styles.blogCardDate}>{dateStr}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        </ScrollView>
      )}
      {/* SUCCESS ORDER MODAL */}
      <Modal animationType="fade" transparent={true} visible={successVisible}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: 'white', width: '80%', padding: 30, borderRadius: 25, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}>

            <View style={{ width: 80, height: 80, backgroundColor: '#e8f5e9', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
            </View>

            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>Замовлення прийнято! 🎉</Text>
            <Text style={{ color: '#666', textAlign: 'center', marginBottom: 25, lineHeight: 22 }}>
              Дякуємо за довіру.{'\n'}Менеджер зв&apos;яжеться з вами найближчим часом для підтвердження.
            </Text>

            <TouchableOpacity 
              onPress={() => {
                setSuccessVisible(false);
                setTimeout(() => {
                  router.push('/(tabs)/profile');
                }, 300);
              }}
              style={{ backgroundColor: 'black', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 15, width: '100%' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>Чудово</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
      {/* AI CHAT MODAL */}
      <Modal animationType="slide" visible={aiVisible} presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f2' }}>
          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            {/* Header */}
            <View style={{ 
              padding: 15, 
              backgroundColor: 'white', 
              borderBottomWidth: 1, 
              borderColor: '#e0e0e0',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ 
                  width: 45, 
                  height: 45, 
                  backgroundColor: '#E8F5E9', 
                  borderRadius: 22.5, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginRight: 12 
                }}>
                  <Ionicons name="chatbubble-ellipses" size={24} color="#2E7D32" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 17, color: '#000' }}>Експерт природи 🌿</Text>
                  <Text style={{ color: '#4CAF50', fontSize: 13, marginTop: 2 }}>Online • Готовий допомогти</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setAiVisible(false)}
                style={{ padding: 8, borderRadius: 8 }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Сообщения */}
            <FlatList
              ref={chatFlatListRef}
              data={messages}
              renderItem={({ item }) => {
                const isUser = item.sender === 'user';
                return (
                  <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 15 }}>
                    {/* Текст сообщения */}
                    <View style={[
                      {
                        padding: 12,
                        borderRadius: 18,
                        maxWidth: '80%',
                      },
                      isUser ? {
                        backgroundColor: '#000',
                        borderBottomRightRadius: 4,
                      } : {
                        backgroundColor: '#fff',
                        borderBottomLeftRadius: 4,
                        borderWidth: 1,
                        borderColor: '#e5e5e5',
                      }
                    ]}>
                      <Text style={{ 
                        color: isUser ? '#fff' : '#333', 
                        fontSize: 16 
                      }}>
                        {item.text}
                      </Text>
                    </View>

                    {/* Карточки товаров (только у бота) */}
                    {!isUser && (item as any).products && Array.isArray((item as any).products) && (item as any).products.length > 0 && (
                      <View style={{ marginTop: 8, width: '85%' }}>
                        {((item as any).products as any[]).map((prod: any) => (
                          <TouchableOpacity 
                            key={prod?.id || Math.random()} 
                            style={{
                              flexDirection: 'row',
                              backgroundColor: '#fff',
                              padding: 10,
                              borderRadius: 12,
                              marginBottom: 8,
                              borderWidth: 1,
                              borderColor: '#eee',
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOpacity: 0.05,
                              shadowRadius: 5,
                              elevation: 2,
                            }}
                            activeOpacity={0.7}
                            onPress={() => {
                              setAiVisible(false);
                              setTimeout(() => {
                                router.push(`/product/${prod?.id}`);
                              }, 300);
                            }}
                          >
                            <Image 
                              source={{ uri: getImageUrl(prod.image || prod.image_url || prod.picture) }} 
                              style={{
                                width: 50,
                                height: 50,
                                borderRadius: 8,
                                marginRight: 12,
                                backgroundColor: '#f0f0f0',
                              }}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                            />
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                              <Text style={{
                                fontWeight: '600',
                                fontSize: 14,
                                color: '#000',
                                marginBottom: 4,
                              }} numberOfLines={1}>
                                {prod.name}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {prod.old_price != null && Number(prod.old_price) > Number(prod.price) ? (
                                  <Text style={{
                                    textDecorationLine: 'line-through',
                                    color: '#999',
                                    fontSize: 12
                                  }}>
                                    {formatPrice(Number(prod.old_price))}
                                  </Text>
                                ) : null}
                                <Text style={{
                                  color: '#2ecc71',
                                  fontWeight: 'bold',
                                  fontSize: 14,
                                }}>
                                  {formatPrice(prod.price)}
                                </Text>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              }}
              keyExtractor={item => `msg-${item?.id || Math.random()}`}
              contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
              style={{ flex: 1 }}
              onContentSizeChange={() => {
                setTimeout(() => {
                  chatFlatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
              ListFooterComponent={
                isLoading ? (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    paddingVertical: 12,
                    alignSelf: 'flex-start'
                  }}>
                    <ActivityIndicator size="small" color="#999" style={{ marginRight: 10 }} />
                    <Text style={{ color: '#999', fontSize: 14 }}>Бот печатає...</Text>
                  </View>
                ) : null
              }
            />

            {/* Зона ввода */}
            <View style={{
              flexDirection: 'row',
              padding: 10,
              paddingHorizontal: 15,
              backgroundColor: '#fff',
              borderTopWidth: 1,
              borderColor: '#eee',
              alignItems: 'center',
            }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 25,
                  paddingHorizontal: 15,
                  paddingVertical: 10,
                  fontSize: 16,
                  marginRight: 10,
                  height: 45,
                }}
                value={inputMessage}
                onChangeText={setInputMessage}
                placeholder="Запитайте про товар..."
                placeholderTextColor="#888"
                onSubmitEditing={sendMessage}
                editable={!isLoading}
                multiline={false}
              />
              <TouchableOpacity 
                style={{
                  width: 45,
                  height: 45,
                  borderRadius: 25,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: (isLoading || !inputMessage.trim()) ? '#b0b0b0' : '#000'
                }} 
                onPress={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
            ...(Platform.OS === 'ios' ? { zIndex: 10000 } : null),
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
      {/* Floating Chat Button */}
      <FloatingChatButton bottomOffset={30} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  categoriesList: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  categoryItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  categoryItemActive: {
    backgroundColor: Colors.light.tint,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  categoryTextActive: {
    color: '#fff',
  },
  mainScroll: {
    flex: 1,
  },
  section: {
    marginBottom: 8,
  },
  productsListContent: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 16,
  },
  productCardWrapper: {
    width: 160,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  recentlyViewedThumb: {
    width: 80,
    height: 80,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  recentlyViewedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  recentlyViewedPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  blogCard: {
    width: 280,
    marginRight: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  blogCardImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#f0f0f0',
  },
  blogCardContent: {
    padding: 12,
  },
  blogCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  blogCardDate: {
    fontSize: 12,
    color: '#6b7280',
  },
});


