import { FloatingChatButton } from '@/components/FloatingChatButton';
import { Colors } from '@/constants/theme';
import { API_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { getImageUrl, pickPrimaryProductImagePath } from '@/utils/image';
import { logAddToCart } from '../../src/utils/analytics';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Animated, Dimensions, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from "react-native";
import ProductCard from '../../components/ProductCard';
import { useFavoritesStore } from '../../store/favoritesStore';

// Анимированная кнопка избранного
const AnimatedFavoriteButton = ({ item, onPress }: { 
  item: any; 
  onPress: () => void; 
}) => {
  const { favorites } = useFavoritesStore();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isFavorite = favorites.some(fav => fav.id === item?.id);
  
  const handlePress = () => {
    // Анимация пульсации
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    onPress();
  };
  
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        onPress={handlePress}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
          borderWidth: 0.5,
          borderColor: 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <Ionicons 
          name={isFavorite ? "heart" : "heart-outline"} 
          size={18} 
          color={isFavorite ? "#ef4444" : "#374151"} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Move types to top
type Variant = {
  id?: number;
  size: string;
  price: number;
  label?: string; // New field for normalized label
};

type Product = {
  id: number;
  name: string;
  price: number;
  minPrice?: number; // New field from grouping
  image?: string;
  image_url?: string;  // For CSV imports
  picture?: string;     // For XML imports
  category?: string;
  rating?: number;
  size?: string;
  description?: string;
  badge?: string;
  quantity?: number;
  composition?: string; // Changed from ingredients to match OrdersContext
  usage?: string;
  weight?: string;
  pack_sizes?: string[] | string;  // Changed to array to match backend, but might be string from DB
  old_price?: number;  // For discount logic
  unit?: string;  // Measurement unit (e.g., "шт", "г", "мл")
  delivery_info?: string;
  return_info?: string;
  option_names?: string | null; // Variation dimension titles (e.g., "weight|form|sort")
  variants?: Variant[] | any[];  // Variants with different prices or JSON string from DB
  variationGroups?: any[]; // For multi-dimensional variations
};

const asArray = (value: any) => (Array.isArray(value) ? value : []);

const parseMaybeJsonArray = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeSelectOption = (option: any) => {
  if (option === undefined || option === null) return { label: '—', value: '—' };
  if (typeof option === 'string' || typeof option === 'number') {
    const s = String(option).trim();
    return { label: s || '—', value: s || '—' };
  }
  const labelCandidate = option?.name ?? option?.size ?? option?.value ?? String(option);
  const valueCandidate = option?.value ?? option?.id ?? labelCandidate;
  const label = String(labelCandidate ?? '—').trim() || '—';
  const value = String(valueCandidate ?? label).trim() || label;
  return { label, value };
};

const getVariantSelectionValue = (variant: any) => {
  if (variant === undefined || variant === null) return '';
  if (typeof variant === 'string' || typeof variant === 'number') return String(variant).trim();

  const candidate =
    variant?.label ??
    variant?.size ??
    variant?.name ??
    variant?.pack_size ??
    variant?.packSize ??
    variant?.weight ??
    variant?.value;

  return String(candidate ?? '').trim();
};

const hasNonEmptyText = (value: any) => typeof value === 'string' && value.trim().length > 0;

const toDisplayText = (value: any) => {
  const s = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return s.length > 0 ? s : '—';
};

const parseOptionNames = (value: any) => {
  if (typeof value !== 'string') return [];
  return value
    .split('|')
    .map((name: any) => String(name ?? '').trim())
    .filter((name: string) => name.length > 0);
};

const getVariantOptionParts = (variant: any) => {
  if (variant === undefined || variant === null) return [];

  // 1. Try specifically mapped attributes first if they exist
  if (variant.attrs && typeof variant.attrs === 'object') {
     // If we have attrs, we might still need to match them to indices if we use option_names
     // But usually we prefer to map them by key. 
     // For now, let's try to extract values in order if we are using indexed matching
  }

  const raw =
    (typeof variant?.name === 'string' && variant.name) ||
    (typeof variant?.size === 'string' && variant.size) ||
    (typeof variant?.label === 'string' && variant.label) ||
    (typeof variant === 'string' && variant) ||
    '';

  if (!raw || typeof raw !== 'string') return [];
  return raw.split('|').map((part: any) => String(part ?? '').trim());
};

const normalizeComparable = (value: any) => String(value ?? '').toLowerCase().trim();

const getOptIndexFromKey = (key: any) => {
  if (typeof key !== 'string') return null;
  if (!key.startsWith('opt_')) return null;

  const n = Number(key.slice(4));
  return Number.isFinite(n) ? n : null;
};

const buildVariationGroupsFromOptionNames = (optionNames: string[], variants: any[]) => {
  const safeOptionNames = Array.isArray(optionNames) ? optionNames.filter(Boolean) : [];
  const safeVariants = Array.isArray(variants) ? variants.filter((v) => v != null) : [];

  return safeOptionNames
    .map((title, index) => {
      const options: string[] = [];

      safeVariants.forEach((variant) => {
        const parts = getVariantOptionParts(variant);
        const value = parts[index];
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (trimmed && !options.includes(trimmed)) options.push(trimmed);
      });

      return {
        id: `opt_${index}`,
        title: String(title ?? '').trim() || 'Варіант',
        options,
        __source: 'option_names',
        __index: index,
      };
    })
    .filter((g: any) => Array.isArray(g?.options) && g.options.length > 0);
};

const findVariantByOptionNameSelections = (variants: any[], selections: any) => {
  const safeVariants = parseMaybeJsonArray(variants).filter((v: any) => v != null);
  if (safeVariants.length === 0) return null;

  const keys = Object.keys(selections || {}).filter((key) => getOptIndexFromKey(key) !== null);
  if (keys.length === 0) return safeVariants[0] ?? null;

  const targets = keys
    .map((key) => {
      const index = getOptIndexFromKey(key);
      if (index === null) return null;
      return { index, value: normalizeComparable(selections?.[key]) };
    })
    .filter(Boolean) as Array<{ index: number; value: string }>;

  const exact = safeVariants.find((variant: any) => {
    const parts = getVariantOptionParts(variant);
    return targets.every(({ index, value }) => normalizeComparable(parts[index]) === value);
  });
  if (exact) return exact;

  let best: any = safeVariants[0] ?? null;
  let bestScore = -1;

  safeVariants.forEach((variant: any) => {
    const parts = getVariantOptionParts(variant);
    let score = 0;

    targets.forEach(({ index, value }) => {
      if (normalizeComparable(parts[index]) === value) score += 1;
    });

    if (score > bestScore) {
      bestScore = score;
      best = variant;
    }
  });

  return best;
};

// ... BannerImage and ProductImage remain here ...

// ...

// IMPORTANT: Do not put component logic here.

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
  
  if (error) {
    // Fallback UI (Placeholder)
    return (
      <View style={{
        width,
        height,
        backgroundColor: '#f5f5f5',
        borderRadius: 0,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center'
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
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        marginRight: 10,
        backgroundColor: '#f5f5f5'
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

// ProductImage component for handling images with error fallback
const ProductImage = ({ uri, style }: { uri: string; style?: any }) => {
  const [error, setError] = useState(false);
  const [useProxy, setUseProxy] = useState(true);
  const { width } = Dimensions.get('window');
  
  // Для вертикальных карточек используем полную ширину
  const cardImageWidth = width - 32; // Ширина экрана минус отступы
  
  const trimmed = (uri || '').trim();

  const originalUri = trimmed ? getImageUrl(trimmed) : getImageUrl(null);

  // Proxy URL (backend resizer). Some environments may not have it deployed yet.
  const proxyUri = trimmed ? getImageUrl(trimmed, {
    width: cardImageWidth,
    quality: 85,
    format: 'webp' // WebP для лучшего сжатия
  }) : getImageUrl(null);

  const activeUri = useProxy ? proxyUri : originalUri;

  useEffect(() => {
    setError(false);
    setUseProxy(true);
  }, [proxyUri, originalUri]);

  if (error) {
    // Fallback UI (Placeholder) в органическом стиле
    return (
      <View style={{ 
        width: '100%', 
        height: 200, 
        backgroundColor: '#F5F5F5', 
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        justifyContent: 'center', 
        alignItems: 'center'
      }}>
        <Ionicons name="image-outline" size={40} color="#ccc" />
        <Text style={{ color: '#999', marginTop: 8, fontSize: 14 }}>Немає фото</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: activeUri }}
      style={style || { width: '100%', height: 200, borderRadius: 8 }}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={(e) => {
        const msg = (e as any)?.nativeEvent?.error ?? (e as any)?.message;
        const msgText = typeof msg === 'string' ? msg : '';

        // If backend resizer isn't deployed (404), retry with the original URL.
        if (useProxy && (msgText.includes('code=404') || msgText.includes(' 404') || msgText.includes('HTTP 404'))) {
          setUseProxy(false);
          return;
        }

        console.error('❌ Product image failed to load:', activeUri, msgText ? `(${msgText})` : '');
        setError(true);
      }}
    />
  );
};

export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // Get cart context
  const { addItem, items: cartItems, removeItem, clearCart, totalPrice, updateQuantity, addOne, removeOne } = useCart();
  // Get favorites store
  const { favorites, toggleFavorite } = useFavoritesStore();

  // Get products from OrdersContext (fetched from server)
  const { products, isLoading, fetchProducts, orders, removeOrder, clearOrders } = useOrders();

  // Placeholder for useEffect removal

  // Функция форматирования цены
  const formatPrice = (price: number) => {
    const safePrice = price || 0;
    return `${safePrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  };

  // Используем cartItems из контекста вместо локального cart
  const cart = cartItems; // Алиас для совместимости со старым кодом
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Всі");
  const [sortType, setSortType] = useState<'popular' | 'asc' | 'desc'>('popular');
  const [successVisible, setSuccessVisible] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [banners, setBanners] = useState<any[]>([]);

  const [connectionError, setConnectionError] = useState(false);

  // Render Product Item
  const renderProductItem = ({ item }: { item: Product }) => {
    const isFavorite = favorites.some(fav => fav.id === item?.id);
    // Display "from X UAH" if multiple variants exist
    const displayPrice = item.variants && item.variants.length > 1 && item.minPrice
        ? `від ${formatPrice(item.minPrice)}`
        : formatPrice(item.price);
        
    return (
      <ProductCard
        item={item} // Pass item as is
        displayPrice={displayPrice} // Pass custom price string
        onPress={() => {
          if (!item?.id) {
            Alert.alert('Увага', 'id не знайдено');
            return;
          }
          router.push(`/product/${item.id}`);
        }}
        onFavoritePress={() => {
           // ... favorite logic ...
           Vibration.vibrate(10);
           toggleFavorite({
               id: item.id,
               name: item.name,
               price: item.price,
               image: pickPrimaryProductImagePath(item) || '',
               category: item.category,
               old_price: item.old_price,
               badge: item.badge,
               unit: item.unit
           });
           showToast(isFavorite ? 'Видалено з обраного' : 'Додано в обране ❤️');
        }}
        onCartPress={async () => {
           Vibration.vibrate(10);
           addItem(item, 1, item.unit || 'шт');
           try {
             await logAddToCart(item);
           } catch (_) {}
           showToast('Товар додано в кошик');
        }}
        isFavorite={isFavorite}
      />
    );
  };

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

  // Load banners on mount
  useEffect(() => {
    loadBanners();
  }, []);

  // Загрузка баннеров из кэша при монтировании (для быстрого старта)
  useEffect(() => {
    const loadCachedBanners = async () => {
      const CACHE_KEY = 'cached_banners_v2';
      try {
        const cachedData = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedData) {
          try {
            const cachedBanners = JSON.parse(cachedData);
            if (Array.isArray(cachedBanners) && cachedBanners.length > 0) {
              // Используем оптимизированные данные из кэша как есть
              setBanners(cachedBanners); // Показываем кэшированные баннеры сразу при старте
            }
          } catch (parseError) {
            // Очищаем поврежденный кэш
            await AsyncStorage.removeItem(CACHE_KEY);
          }
        }
      } catch (error) {
        // Очищаем поврежденный кэш
        try {
          await AsyncStorage.removeItem('cached_banners_v2');
        } catch (clearError) {
          // Ignore
        }
      }
    };
    loadCachedBanners();
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
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);
  const chatFlatListRef = useRef<FlatList>(null);
  const bannerRef = useRef<ScrollView>(null);


  // Автоматическая прокрутка баннеров
  useEffect(() => {
    if (banners.length === 0) return;
    
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % banners.length;
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5
      });
    }, 4000); // Листаем каждые 4 секунды
    return () => clearInterval(interval);
  }, [banners]);

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

  const addToCart = (item: Product, size?: string) => {
    Vibration.vibrate(50); // Легкий отклик (50мс)
    const packSize = size ? String(parseInt(size)) : '30'; // Конвертируем size в строку или используем '30' по умолчанию
    addItem(item, 1, packSize);
    showToast('Товар додано в кошик');
  };

  const applyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'START') {
      setDiscount(0.1); // 10% скидка
      showToast('Промокод активовано! -10%');
    } else {
      setDiscount(0);
      showToast('Невірний промокод');
    }
  };



  const onShare = async (product: Product) => {
    try {
      await Share.share({
        message: `Дивись, цікава річ: ${product.name} за ${formatPrice(product.price)}!`,
      });
    } catch (error: any) {
      console.log(error.message);
    }
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

  const subtotal = cart.reduce((sum: number, item: Product) => sum + (item.price * (item.quantity || 1)), 0);
  const totalAmount = subtotal - (subtotal * discount);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  // Safe products array
  const safeProducts = Array.isArray(products) ? products : [];

  // Derive categories from products
  const derivedCategories = useMemo(() => {
    const categorySet = new Set<string>();
    safeProducts.forEach(p => {
      if (p?.category) {
        categorySet.add(p.category);
      }
    });
    return ['Всі', ...Array.from(categorySet)];
  }, [safeProducts]);

  // Фильтрация товаров по поисковому запросу и категории
  const getSortedProducts = () => {
    let result = safeProducts.filter(p => 
      p?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter by category
    if (selectedCategory !== 'Всі') {
      result = result.filter(p => p?.category === selectedCategory);
    }

    if (sortType === 'asc') {
      return result.sort((a, b) => a.price - b.price);
    } else if (sortType === 'desc') {
      return result.sort((a, b) => b.price - a.price);
    }
    return result; // 'popular' - порядок по умолчанию (id)
  };
  
  const filteredProducts = getSortedProducts();

  // Products are fetched via OrdersContext (API)

  // Auto-scrolling banner carousel
  useEffect(() => {
    if (banners.length === 0) return;
    
    const { width } = Dimensions.get('window');
    const CARD_WIDTH = width - 40;
    const CARD_MARGIN = 10;
    const TOTAL_WIDTH = CARD_WIDTH + CARD_MARGIN;
    
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
          <Text style={{ fontSize: 28, fontWeight: '900', color: 'black', letterSpacing: -1 }}>Dikoros UA 🍄</Text>
          <Text style={{ fontSize: 13, color: '#888', fontWeight: '500' }}>Твій природний вибір</Text>
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
      {/* BANNERS */}
      {banners.length > 0 && (() => {
        const { width } = Dimensions.get('window');
        const CARD_WIDTH = width - 40;
        return (
          <ScrollView 
            ref={bannerRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            pagingEnabled={true}
            style={{ marginTop: -6, marginBottom: 20 }}
            contentContainerStyle={{ paddingLeft: 20, paddingRight: 20 }}
            snapToInterval={CARD_WIDTH + 10}
            decelerationRate="fast"
          >
            {banners.map((b) => {
              // Обеспечиваем правильное формирование URL для баннера
              // Используем getImageUrl для обработки относительных путей
              const imageUrl = b.image_url || b.image || b.picture;
              if (!imageUrl) {
                return null;
              }
              const fullImageUrl = getImageUrl(imageUrl);
              
              return (
                <BannerImage 
                  key={b?.id || Math.random()}
                  uri={fullImageUrl}
                  width={CARD_WIDTH}
                  height={220}
                />
              );
            })}
          </ScrollView>
        );
      })()}
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
      {/* CATEGORY CHIPS */}
      <View style={styles.categoriesList}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {derivedCategories.map((cat, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                if (cat !== selectedCategory) {
                  Vibration.vibrate(10);
                }
                setSelectedCategory(cat);
              }}
              style={[
                styles.categoryItem,
                selectedCategory === cat && styles.categoryItemActive
              ]}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === cat && styles.categoryTextActive
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {/* SORT & COUNT PANEL */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, marginBottom: 15 }}>
        <Text style={{ color: '#888', fontWeight: '600' }}>
          <Text>Знайдено: </Text>
          <Text>{filteredProducts.length}</Text>
        </Text>

        <TouchableOpacity 
          onPress={() => {
            // Циклическое переключение: Popular -> Cheap -> Expensive -> Popular
            if (sortType === 'popular') { setSortType('asc'); showToast('Спочатку дешевші'); }
            else if (sortType === 'asc') { setSortType('desc'); showToast('Спочатку дорожчі'); }
            else { setSortType('popular'); showToast('За популярністю'); }
            Vibration.vibrate(10);
          }}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontWeight: 'bold', marginRight: 5 }}>
            {sortType === 'popular' ? 'Популярні' : sortType === 'asc' ? 'Дешевші' : 'Дорожчі'}
          </Text>
          <Ionicons name="swap-vertical" size={16} color="black" />
        </TouchableOpacity>
      </View>

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
        <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={item => item?.id?.toString() || Math.random().toString()}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.tint]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>😔</Text>
              <Text style={styles.emptyStateMessage}>Нічого не знайдено</Text>
            </View>
          }
        />
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
  },
  categoryItemActive: {
    backgroundColor: Colors.light.tint,
    shadowColor: Colors.light.tint,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyStateText: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});


