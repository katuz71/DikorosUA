import { FloatingChatButton } from '@/components/FloatingChatButton';
import ProductInfo from '@/components/ProductInfo';
import { Colors } from '@/constants/theme';
import { API_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { trackEvent } from '@/utils/analytics';
import { getImageUrl, parseImages } from '@/utils/image';
// Импорт парсера
import { ParsedVariant } from '@/utils/productParser';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
  useWindowDimensions
} from 'react-native';
import RenderHTML from 'react-native-render-html';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavoritesStore } from '../../store/favoritesStore';

// Утилита нормализации (для локального использования)
const normalize = (str: string | number | undefined) => {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, ''); 
};

// Убирает HTML-теги из строки, <br> заменяет на перенос строки
const stripHtmlTags = (html: string): string => {
  if (!html || !html.trim()) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
};

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addItem, items: cartItems } = useCart();
  const { products } = useOrders(); // Здесь лежат все товары
  const { favorites, toggleFavorite } = useFavoritesStore();
  const insets = useSafeAreaInsets();

  const cartCount = cartItems.reduce((total: number, item: any) => total + (item.quantity || 1), 0);
  const { width: screenWidth } = Dimensions.get('window');
  const { width: windowWidth } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const [product, setProduct] = useState<any>(null);
  const [productDetail, setProductDetail] = useState<any>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRequestRef = useRef<number | null>(null);
  
  // --- STATE ВЫБОРА ---
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedWeight, setSelectedWeight] = useState<string>('');
  const [selectedSimpleOption, setSelectedSimpleOption] = useState<string>('');

  const [resolvedVariant, setResolvedVariant] = useState<ParsedVariant | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // Списки для UI
  const [uiGrades, setUiGrades] = useState<string[]>([]);
  const [uiTypes, setUiTypes] = useState<string[]>([]);
  const [uiWeights, setUiWeights] = useState<string[]>([]);
  const [uiSimpleOptions, setUiSimpleOptions] = useState<string[]>([]);
  
  const [activeTab, setActiveTab] = useState('description');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tabsScrollViewRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<{[key: string]: number}>({});
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, user_name: '', user_phone: '', comment: '' });

  // --- ХЕЛПЕРЫ ---
  const formatPrice = (price: number) => {
    const val = price || 0;
    return `${val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setToastVisible(false));
      }, 2000);
    });
  };

  // --- 1. ЗАГРУЗКА ---
  useEffect(() => {
    if (!id) return;

    const productId = Number(Array.isArray(id) ? id[0] : id);
    if (!productId) return;

    // Reset state on product change
    setProductDetail(null);
    setDetailError(null);

    setSelectedGrade('');
    setSelectedType('');
    setSelectedWeight('');
    setSelectedSimpleOption('');
    setResolvedVariant(null);
    setCurrentPrice(0);
    setUiGrades([]);
    setUiTypes([]);
    setUiWeights([]);
    setUiSimpleOptions([]);

    // Use list as preliminary data (preview)
    if (products && products.length > 0) {
      const found = products.find((p: any) => p.id === productId);
      if (found) {
        setProduct(found);
        trackEvent('ViewContent', { content_ids: [found.id], content_type: 'product', value: found.price, currency: 'UAH', content_name: found.name });
      }
    }

    // Always hydrate details from API (source of truth)
    const hydrate = async () => {
      detailRequestRef.current = productId;
      setDetailError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const res = await fetch(`${API_URL}/products/${productId}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const full = await res.json();
        if (detailRequestRef.current !== productId) return;
        setProductDetail(full);
      } catch (e: any) {
        if (detailRequestRef.current !== productId) return;
        const msg = e?.name === 'AbortError' ? 'Таймаут завантаження деталей' : 'Помилка завантаження деталей';
        setDetailError(msg);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    hydrate();
  }, [products, id]);

  const loadReviews = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/reviews/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      // Backend can return either an array OR { reviews, average_rating, total_count }
      const nextReviews = Array.isArray(json) ? json : (Array.isArray(json?.reviews) ? json.reviews : []);
      setReviews(nextReviews);
    } catch {}
  }, [id]);
  useEffect(() => { loadReviews(); }, [loadReviews]);

  useEffect(() => {
    if (!reviewModalVisible) return;

    (async () => {
      try {
        const storedPhone = (await AsyncStorage.getItem('userPhone')) || '';
        const storedName = (await AsyncStorage.getItem('userName')) || '';

        setNewReview(prev => ({
          ...prev,
          user_phone: prev.user_phone || storedPhone,
          user_name: prev.user_name || storedName,
        }));
      } catch {
        // ignore
      }
    })();
  }, [reviewModalVisible]);

  // --- 2. ИСПОЛЬЗУЕМ ПАРСЕР (ВМЕСТО ГРЯЗНОЙ ЛОГИКИ) ---
  const { variants: allVariants, mode: variantMode } = useMemo(() => {
    // Variants must come ONLY from detail.variants (no grouping, no hardcoded fallbacks)
    if (!productDetail || !productDetail.id) return { variants: [], mode: 'none' as const };

    let rawItems: any[] = [];
    try {
      const src = productDetail.variants;
      const parsed = typeof src === 'string' ? JSON.parse(src) : src;
      if (Array.isArray(parsed)) rawItems = parsed;
    } catch {
      rawItems = [];
    }

    if (!rawItems || rawItems.length <= 1) {
      return { variants: [], mode: 'none' as const };
    }

    const normalizeLocal = (str: string | number | undefined) => {
      if (!str) return '';
      return str.toString().toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, '');
    };

    const hasGrade = rawItems.some((v: any) => {
      const t = (v.name || v.title || v.label || v.size || '').toLowerCase();
      return t.includes('сорт') || t.includes('еліт') || t.includes('elit');
    });

    const uniqueTypes = new Set(
      rawItems.map((v: any) => {
        const t = (v.name || v.title || v.label || v.size || '').toLowerCase();
        const parts = t.split('|').map((p: string) => p.trim());
        let formPart = '';

        if (parts.length >= 3) formPart = parts[1];
        else if (parts.length === 2) {
          if (parts[0].includes('сорт') || parts[0].includes('еліт') || parts[0].includes('elit')) formPart = parts[1];
          else formPart = parts[0];
        } else formPart = t;

        if (formPart.includes('порошок') || formPart.includes('мелений')) return 'порошок';
        if (formPart.includes('капсул')) return 'капсули';
        if (formPart.includes('настоянка')) return 'настоянка';
        if (formPart.includes('шляпк')) return 'шляпки';
        if (formPart.includes('ніжк')) return 'ніжки';
        if (formPart.includes('ціл')) return 'цілі';
        if (formPart.includes('міцелій')) return 'міцелій';
        if (formPart.includes('лом')) return 'лом';

        return formPart.replace(/[^\p{L}]/gu, '').toLowerCase() || '';
      })
    );
    uniqueTypes.delete('');
    const hasMultipleTypes = uniqueTypes.size > 1;

    const mode: 'complex' | 'simple' | 'none' = (hasGrade || hasMultipleTypes) ? 'complex' : 'simple';

    const parsedVariants: ParsedVariant[] = rawItems.map((v: any, index: number) => {
      const title = (v.name || v.title || v.label || v.size || '').toString();
      const titleLower = title.toLowerCase();

      const titleParts = title
        .split('|')
        .map((p: string) => p.trim());

      let grade = '2 сорт';
      let type = 'Цілі';
      let weight = title;

      const weightMatch = titleLower.match(/(\d+(?:[\.,]\d+)?)\s*(?:грам|г|гр|кг|мл|l|л|капсул|шт)/);
      if (weightMatch) {
        weight = weightMatch[0]
          .replace('грам', 'г')
          .replace('гр', 'г')
          .replace(/\s+/g, '');
      }

      if (mode === 'complex') {
        // Если формат "Сорт|Форма|Вага" и сорт пустой ("|Без обробки|50 г"),
        // то в наших данных это соответствует "1 сорт".
        if (titleParts.length >= 3 && titleParts[0] === '') {
          grade = '1 сорт';
        } else if (titleLower.includes('1 сорт') || titleLower.includes('1-й сорт') || titleLower.includes('1сорт')) grade = '1 сорт';
        else if (titleLower.includes('еліт') || titleLower.includes('elit') || titleLower.includes('вищий')) grade = 'Еліт';
        else if (titleLower.includes('2 сорт') || titleLower.includes('2-й сорт') || titleLower.includes('2сорт')) grade = '2 сорт';

        if (titleLower.includes('порошок') || titleLower.includes('мелений')) type = 'Порошок';
        else if (titleLower.includes('капсул')) type = 'Капсули';
        else if (titleLower.includes('настоянка')) type = 'Настоянка';
        else if (titleLower.includes('екстракт')) type = 'Екстракт';
        else if (titleLower.includes('шляпк')) type = 'Шляпки';
        else if (titleLower.includes('ніжк')) type = 'Ніжки';
        else if (titleLower.includes('ціл')) type = 'Цілі';

        // В формате "Сорт|Форма|Вага" вес надёжнее брать из 3-й части,
        // иначе regex может оставить весь title.
        if (titleParts.length >= 3 && titleParts[2]) {
          weight = titleParts[2].replace(/\s+/g, '');
        }
      } else {
        if (!weightMatch) weight = title || `Варіант ${index + 1}`;
      }

      return {
        id: v.id || (index + 999999),
        price: Number(v.price),
        old_price: v.old_price ? Number(v.old_price) : undefined,
        title,
        grade,
        type,
        weight,
        normGrade: normalizeLocal(grade),
        normType: normalizeLocal(type),
        normWeight: normalizeLocal(weight),
        isComplex: mode === 'complex',
        origVariant: v,
      };
    });

    return { variants: parsedVariants, mode };
  }, [productDetail]);

  // --- 3. UI СПИСКИ ---
  useEffect(() => {
    
    if (!allVariants.length) return;

    if (variantMode === 'complex') {
        const normSelectedGrade = normalize(selectedGrade);
        const normSelectedType = normalize(selectedType);

        const gradeFiltered = normSelectedGrade
          ? allVariants.filter((v: ParsedVariant) => v.normGrade === normSelectedGrade)
          : allVariants;

        const typeFiltered = normSelectedType
          ? gradeFiltered.filter((v: ParsedVariant) => v.normType === normSelectedType)
          : gradeFiltered;

        const grades = Array.from(new Set(allVariants.map((v: ParsedVariant) => v.grade))).sort();
        const types = Array.from(new Set(gradeFiltered.map((v: ParsedVariant) => v.type))).sort();
        const weights = Array.from(new Set(typeFiltered.map((v: ParsedVariant) => v.weight))).sort((a: string, b: string) => {
            const valA = parseFloat(a.replace(/[^\d\.]/g, '')) || 0;
            const valB = parseFloat(b.replace(/[^\d\.]/g, '')) || 0;
            return valA - valB;
        });

        setUiGrades(grades);
        setUiTypes(types);
        setUiWeights(weights);

        if (!selectedGrade) {
          // Пытаемся выбрать "2 сорт" / "Цілі"
          const def = allVariants.find((v: ParsedVariant) => v.normGrade.includes('2') || v.normGrade.includes('stand')) || allVariants[0];
          setSelectedGrade(def.grade);
          setSelectedType(def.type);
          setSelectedWeight(def.weight);
          return;
        }

        // Если после смены сорта/формы текущие значения стали недоступны — корректируем.
        if (types.length > 0 && !types.includes(selectedType)) {
          setSelectedType(types[0]);
          return;
        }
        if (weights.length > 0 && !weights.includes(selectedWeight)) {
          setSelectedWeight(weights[0]);
        }
    } else {
        // Простой режим
        const options = Array.from(new Set(allVariants.map((v: ParsedVariant) => v.weight)));
        options.sort((a: string, b: string) => {
             const valA = parseFloat(a.replace(/[^\d\.]/g, '')) || 0;
             const valB = parseFloat(b.replace(/[^\d\.]/g, '')) || 0;
             return valA - valB;
        });
        
        setUiSimpleOptions(options);
        // Авто-выбор (берем первый, самый дешевый/легкий)
        if (!selectedSimpleOption && options.length > 0) {
            setSelectedSimpleOption(options[0]);
        }
    }
  }, [allVariants, variantMode, selectedGrade, selectedType, selectedWeight, selectedSimpleOption]);

  // --- 4. RESOLVER (ПОИСК) ---
  useEffect(() => {
      // Price + selection must come ONLY from detail
      if (!productDetail || !productDetail.id) {
        setResolvedVariant(null);
        setCurrentPrice(0);
        return;
      }

      if (variantMode === 'none') {
          // Одиночный товар
          setResolvedVariant(null);
          setCurrentPrice(Number(productDetail?.price) || 0);
          return;
      }

      let found: ParsedVariant | undefined;

      if (variantMode === 'simple') {
          const target = normalize(selectedSimpleOption);
          found = allVariants.find((v: ParsedVariant) => v.normWeight === target);
      } else {
          // Complex: сначала пытаемся учесть форму (type), затем фоллбэк на сорт+вага.
          const tGrade = normalize(selectedGrade);
          const tType = normalize(selectedType);
          const tWeight = normalize(selectedWeight);

          found = allVariants.find((v: ParsedVariant) =>
            v.normGrade === tGrade && v.normType === tType && v.normWeight === tWeight
          );
          if (!found) {
            found = allVariants.find((v: ParsedVariant) =>
              v.normGrade === tGrade && v.normWeight === tWeight
            );
          }
      }

      setResolvedVariant(found || null);
      if (found) setCurrentPrice(found.price);
        else setCurrentPrice(Number(productDetail?.price) || 0);

      }, [selectedGrade, selectedType, selectedWeight, selectedSimpleOption, allVariants, variantMode, productDetail]);

  // --- ДЕЙСТВИЯ ---
  const handleAddToCart = () => {
    if (!productDetail || !productDetail.id) {
      showToast('Завантаження...');
      return;
    }

    Vibration.vibrate(10);

    let finalName = productDetail.name;
    let finalId = productDetail.id;

    if (variantMode !== 'none') {
        if (!resolvedVariant) { 
            // Если вариантов много, а выбор не сделан - ошибка
            if (allVariants.length > 1) {
                showToast('Варіант не знайдено'); return; 
            }
            // Если вариант 1 (глюк парсинга), берем оригинал
        } else {
            finalId = resolvedVariant.id;
            // Красивое имя
            if (variantMode === 'complex') {
          finalName = `${productDetail.name} (${selectedGrade} | ${selectedType} | ${selectedWeight})`;
            } else {
          finalName = `${productDetail.name} (${selectedSimpleOption})`;
            }
        }
    }
    
    const packSize = variantMode === 'complex' ? selectedWeight : (selectedSimpleOption || 'шт');
    const itemToAdd = { ...productDetail, id: finalId, price: currentPrice, name: finalName };
    
    addItem(itemToAdd, 1, packSize, productDetail.unit || 'шт', currentPrice);
    trackEvent('AddToCart', { content_ids: [finalId], content_type: 'product', value: currentPrice, currency: 'UAH', content_name: finalName });
    showToast('Додано в кошик');
  };

  const submitReview = async () => {
    if (!newReview.user_name.trim()) { showToast('Введіть ваше ім\'я'); return; }
    if (!String(newReview.user_phone || '').replace(/\D/g, '')) { showToast('Введіть телефон'); return; }
    if (!newReview.comment.trim()) { showToast('Напишіть відгук'); return; }
    try {
      const cleanPhone = String(newReview.user_phone || '').replace(/\D/g, '');
      const response = await fetch(`${API_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: parseInt(id as string), user_name: newReview.user_name, user_phone: cleanPhone, rating: newReview.rating, comment: newReview.comment })
      });
      if (response.ok) {
        // Persist so Profile → "Мої відгуки" can see it.
        try {
          await AsyncStorage.setItem('userPhone', cleanPhone);
          if (newReview.user_name.trim()) await AsyncStorage.setItem('userName', newReview.user_name.trim());
        } catch {
          // ignore
        }
        showToast('Дякуємо за відгук!');
        setReviewModalVisible(false);
        setNewReview({ rating: 5, user_name: '', user_phone: '', comment: '' });
        loadReviews();
      } else { showToast('Помилка при відправці відгуку'); }
    } catch { showToast('Помилка при відправці відгуку'); }
  };

  const handleTabPress = (tabKey: string) => {
    setActiveTab(tabKey);
    const xPosition = tabLayouts.current[tabKey] || 0;
    tabsScrollViewRef.current?.scrollTo({ x: Math.max(0, xPosition - 50), animated: true });
  };

  const handleToggleFavorite = () => {
    const forFav = productDetail || product;
    if (!forFav?.id) return;

    Vibration.vibrate(10);
    toggleFavorite({ ...forFav, price: currentPrice });
    const isNowFavorite = favorites.some(fav => fav.id === forFav.id);
    showToast(isNowFavorite ? "Видалено з обраного" : "Додано в обране ❤️");
  };

  const handleShare = async () => {
    const p = productDetail || product;
    if (!p) return;
    try { Vibration.vibrate(10); await Share.share({ message: `${p.name}\n${formatPrice(currentPrice)}`, title: p.name }); } catch {}
  };

  // --- RENDER ---
  const displayProduct = productDetail || product;
  const isDetailReady = !!productDetail?.id;
  if (!displayProduct?.id) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#000" />;

  const headerOpacity = scrollY.interpolate({ inputRange: [0, 50], outputRange: [0.7, 1], extrapolate: 'clamp' });
  const headerBorderWidth = scrollY.interpolate({ inputRange: [0, 50], outputRange: [0, 1], extrapolate: 'clamp' });

  // Цена для отображения
  const displayOldPrice = resolvedVariant?.old_price || productDetail?.old_price;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 80 + insets.top }} showsVerticalScrollIndicator={false} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })} scrollEventThrottle={16}>
        {/* CAROUSEL */}
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: screenWidth }}>
            {(() => {
              const images = parseImages(displayProduct.images);
              const fallbackImages = [displayProduct.image || displayProduct.image_url].filter(Boolean);
              const displayImages = images.length > 0 ? images : fallbackImages;
              return displayImages.map((img: string, i: number) => (
                <Image key={i} source={{ uri: getImageUrl(img) }} style={{ width: screenWidth, height: 350, backgroundColor: '#f5f5f5' }} resizeMode="contain" />
              ));
            })()}
          </ScrollView>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={styles.title}>{displayProduct.name}</Text>
          {!!detailError && (
            <Text style={{ color: '#e74c3c', marginTop: 6 }}>{detailError}</Text>
          )}
          <View style={styles.metaRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={{ fontSize: 14, color: '#16A34A', fontWeight: '500' }}>Є в наявності</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={16} color="#FBBF24" />
              <Text style={{ fontSize: 14, color: '#6B7280' }}>4.8 (142)</Text>
            </View>
          </View>

          <View style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
             {!isDetailReady ? (
               <ActivityIndicator size="small" color="#000" />
             ) : (
               <Text style={styles.price}>{formatPrice(currentPrice)}</Text>
             )}
             {!!displayOldPrice && displayOldPrice > currentPrice && (
                 <Text style={styles.oldPrice}>{formatPrice(displayOldPrice)}</Text>
             )}
          </View>

          {/* COMPLEX MODE */}
          {variantMode === 'complex' && (
            <>

              {uiGrades.length > 1 && (
                <View style={styles.selectorGroup}>
                  <Text style={styles.selectorTitle}>Сорт</Text>
                  <View style={styles.selectorRow}>
                    {uiGrades.map(g => (
                      <TouchableOpacity key={g} onPress={() => { setSelectedGrade(g); Vibration.vibrate(10); }} style={[styles.chip, selectedGrade === g && styles.chipActive]}>
                        <Text style={[styles.chipText, selectedGrade === g && styles.chipTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {uiTypes.length > 1 && (
                <View style={styles.selectorGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={styles.selectorTitle}>Форма</Text>
                    <View style={styles.tag}><Text style={styles.tagText}>ОБОВ&apos;ЯЗКОВО</Text></View>
                  </View>
                  <View style={styles.selectorRow}>
                    {uiTypes.map(t => (
                      <TouchableOpacity key={t} onPress={() => { setSelectedType(t); Vibration.vibrate(10); }} style={[styles.chip, selectedType === t && styles.chipActive]}>
                        <Text style={[styles.chipText, selectedType === t && styles.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <View style={styles.selectorGroup}>
                  <Text style={styles.selectorTitle}>Фасування</Text>
                  <View style={styles.selectorRow}>
                    {uiWeights.map(w => (
                      <TouchableOpacity key={w} onPress={() => { setSelectedWeight(w); Vibration.vibrate(10); }} style={[styles.chip, selectedWeight === w && styles.chipActive]}>
                        <Text style={[styles.chipText, selectedWeight === w && styles.chipTextActive]}>{w}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
              </View>
            </>
          )}

          {/* SIMPLE MODE */}
          {variantMode === 'simple' && (
             <>
               <View style={styles.selectorGroup}>
                <Text style={styles.selectorTitle}>Варіант</Text>
                <View style={styles.selectorRow}>
                  {uiSimpleOptions.map(opt => (
                    <TouchableOpacity key={opt} onPress={() => { setSelectedSimpleOption(opt); Vibration.vibrate(10); }} style={[styles.chip, selectedSimpleOption === opt && styles.chipActive]}>
                      <Text style={[styles.chipText, selectedSimpleOption === opt && styles.chipTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
             </View>
             </>
          )}

          {/* BUTTON */}
          <Pressable 
            style={[styles.buyBtn, (!isDetailReady || (!resolvedVariant && variantMode !== 'none' && allVariants.length > 1)) && styles.buyBtnDisabled]}
            disabled={!isDetailReady || (!resolvedVariant && variantMode !== 'none' && allVariants.length > 1)}
            onPress={handleAddToCart}
          >
            <Text style={styles.buyBtnText}>
                {!isDetailReady ? 'Завантаження...' : ((!resolvedVariant && variantMode !== 'none' && allVariants.length > 1) ? 'Недоступно' : 'В кошик')}
            </Text>
          </Pressable>

          <View style={styles.advantages}>
            <View style={styles.advItem}><Ionicons name="shield-checkmark" size={20} color="#4CAF50" /><Text style={styles.advText}>100% Оригінал</Text></View>
            <View style={styles.advItem}><Ionicons name="rocket" size={20} color="#2E7D32" /><Text style={styles.advText}>Швидка доставка</Text></View>
            <View style={styles.advItem}><Ionicons name="calendar" size={20} color="#FF9800" /><Text style={styles.advText}>Свіжі терміни</Text></View>
          </View>

          <View style={styles.divider} />

          {/* TABS */}
          <ScrollView ref={tabsScrollViewRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {[
              { k: 'description' as const, l: 'Опис' },
              { k: 'delivery' as const, l: 'Доставка та оплата' },
              { k: 'return' as const, l: 'Повернення' },
            ].map(t => (
              <TouchableOpacity
                key={t.k}
                onPress={() => handleTabPress(t.k)}
                onLayout={(e) => { tabLayouts.current[t.k] = e.nativeEvent.layout.x; }}
                style={[styles.tabItem, activeTab === t.k && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, activeTab === t.k && styles.tabTextActive]}>{t.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.tabContent}>
            {activeTab === 'description' && (() => {
              const desc = productDetail?.description || productDetail?.long_description || '';
              if (!desc || !desc.trim()) {
                return (
                  <ProductInfo content="" type="description" />
                );
              }
              const htmlSource = { html: desc };
              const tagsStyles = {
                body: { fontSize: 16, lineHeight: 24, color: '#444' },
                b: { color: '#1a1a1a', fontWeight: '700' as const },
                u: { textDecorationLine: 'underline' as const },
              };
              return (
                <View style={[styles.htmlDescriptionWrap, { paddingHorizontal: 20 }]}>
                  <RenderHTML
                    contentWidth={windowWidth - 40}
                    source={htmlSource}
                    tagsStyles={tagsStyles}
                  />
                </View>
              );
            })()}
            {activeTab === 'delivery' && (
              <View style={styles.staticBlock}>
                <Text style={styles.staticHeading}>🚚 Доставка</Text>
                <Text style={styles.staticPara}>• <Text style={styles.staticBold}>Безкоштовна Новою Поштою</Text> — від 1500 грн.</Text>
                <Text style={styles.staticPara}>• <Text style={styles.staticBold}>Безкоштовна Укрпоштою</Text> — від 1000 грн.</Text>
                <Text style={styles.staticPara}>• <Text style={styles.staticBold}>Відправка щодня:</Text> у будні після 19:00, у вихідні після 18:00.</Text>
                <Text style={styles.staticPara}>• <Text style={styles.staticBold}>Комісію за післяплату</Text> (накладений платіж) ми беремо на себе!</Text>
                <Text style={[styles.staticPara, { marginBottom: 15 }]}>• Інші поштові оператори — за домовленістю.</Text>
                <Text style={styles.staticHeading}>💳 Оплата</Text>
                <Text style={[styles.staticPara, styles.staticItalic]}>Мінімальна сума замовлення — 200 грн.</Text>
                <Text style={styles.staticPara}>• Оплата після отримання у перевізника.</Text>
                <Text style={styles.staticPara}>• Банківський переказ на рахунок/картку (ПриватБанк / Монобанк).</Text>
                <Text style={styles.staticPara}>• Готівкою кур'єру при отриманні.</Text>
                <Text style={styles.staticPara}>• Інші способи — по запиту.</Text>
              </View>
            )}
            {activeTab === 'return' && (
              <View style={styles.staticBlock}>
                <Text style={[styles.staticPara, { marginBottom: 10, lineHeight: 22 }]}>
                  Ми дуже стежимо за якістю наших товарів, але якщо все ж таки вам щось не сподобається:
                </Text>
                <Text style={styles.staticPara}>• У вас є <Text style={styles.staticBold}>28 днів</Text> з дня замовлення (14 днів для ознайомлення і 14 днів на пересилку).</Text>
                <Text style={styles.staticPara}>• Повернутий товар має бути в оригінальній упаковці.</Text>
                <Text style={styles.staticPara}>• Послуги пересилання оплачує покупець.</Text>
                <Text style={[styles.staticPara, { marginTop: 10 }]}>
                  <Text style={[styles.staticBold, { color: Colors.light.tint }]}>Гарантія:</Text> Якщо при відправці ми допустили помилку, неточність або виявився брак, усі виправлення та пересилки відбуваються за наш рахунок.
                </Text>
              </View>
            )}
          </View>

          {/* SIMILAR */}
            {products.filter(p => p.category === displayProduct?.category && p.id !== displayProduct?.id).length > 0 && (
             <View style={{ marginBottom: 30 }}>
                 <Text style={styles.sectionHeader}>Схожі товари</Text>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                 {products.filter(p => p.category === displayProduct?.category && p.id !== displayProduct?.id).slice(0, 10).map(p => (
                         <TouchableOpacity key={p.id} onPress={() => router.push(`/product/${p.id}`)} style={styles.simCard}>
                             <Image source={{ uri: getImageUrl(p.image || p.image_url) }} style={styles.simImg} />
                             <View style={{padding:8}}><Text numberOfLines={2} style={styles.simTitle}>{p.name}</Text><Text style={styles.simPrice}>{formatPrice(p.price)}</Text></View>
                         </TouchableOpacity>
                     ))}
                 </ScrollView>
             </View>
          )}

          {/* REVIEWS */}
          <View style={{ marginBottom: 40 }}>
             <Text style={styles.sectionHeader}>Відгуки</Text>
             {reviews.length > 0 ? reviews.map(r => (
                 <View key={r.id} style={styles.reviewItem}>
                     <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:5}}>
                         <Text style={{fontWeight:'700'}}>{r.user_name}</Text>
                         <Text style={{color:'#999',fontSize:12}}>{new Date(r.created_at).toLocaleDateString()}</Text>
                     </View>
                     <Text style={{color:'#444'}}>{r.comment}</Text>
                 </View>
             )) : <Text style={{color:'#999',textAlign:'center',marginVertical:10}}>Відгуків ще немає</Text>}
             <TouchableOpacity style={styles.writeBtn} onPress={() => { Vibration.vibrate(10); setReviewModalVisible(true); }}>
                 <Text style={{fontWeight:'600'}}>Написати відгук</Text>
             </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* HEADER */}
      <Animated.View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, ...(Platform.OS === 'ios' ? { zIndex: 50 } : null), width: '100%', paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: headerBorderWidth, borderBottomColor: '#eee', height: 60 + insets.top }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: headerOpacity }}>
          <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.8)']} style={{ flex: 1 }} />
        </Animated.View>
        <TouchableOpacity onPress={() => { Vibration.vibrate(10); router.back(); }} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color="#000" /></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 15 }}>
          <TouchableOpacity onPress={() => { Vibration.vibrate(10); router.push('/cart'); }} style={styles.iconBtn}>
            <Ionicons name="cart-outline" size={24} color="#000" />
            {cartCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleFavorite} style={styles.iconBtn}>
            <Ionicons name={favorites.some(fav => fav.id === displayProduct?.id) ? "heart" : "heart-outline"} size={24} color={favorites.some(fav => fav.id === displayProduct?.id) ? "#e74c3c" : "#000"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}><Ionicons name="share-outline" size={24} color="#000" /></TouchableOpacity>
        </View>
      </Animated.View>

      {/* TOAST */}
      {toastVisible && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 120, left: 0, right: 0, alignItems: 'center', opacity: fadeAnim }}>
           <View style={{ backgroundColor: '#333', padding: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
               <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginRight:8}} />
               <Text style={{color:'#fff',fontWeight:'600'}}>{toastMessage}</Text>
           </View>
        </Animated.View>
      )}

      {/* MODAL */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent={true} onRequestClose={() => setReviewModalVisible(false)}>
        <View style={[styles.modalOverlay, { paddingBottom: 160 + insets.bottom }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
            <View style={[styles.modalContent, { paddingBottom: 20 + insets.bottom }]}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Написати відгук</Text>
                  <TouchableOpacity onPress={() => { Vibration.vibrate(10); setReviewModalVisible(false); }}><Ionicons name="close" size={24} color="#000" /></TouchableOpacity>
                </View>
                <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
                   {[1,2,3,4,5].map(s => (
                       <TouchableOpacity key={s} onPress={() => setNewReview({...newReview, rating: s})}>
                           <Ionicons name={s <= newReview.rating ? "star" : "star-outline"} size={32} color="#FBBF24" />
                       </TouchableOpacity>
                   ))}
                </View>
                <TextInput style={styles.input} placeholder="Ваше ім'я" value={newReview.user_name} onChangeText={t => setNewReview({...newReview, user_name: t})} />
                <TextInput style={styles.input} placeholder="Телефон" value={newReview.user_phone} onChangeText={t => setNewReview({...newReview, user_phone: t})} keyboardType="phone-pad" />
                <TextInput style={[styles.input, {minHeight:100}]} placeholder="Коментар" multiline value={newReview.comment} onChangeText={t => setNewReview({...newReview, comment: t})} />
              </ScrollView>

              <TouchableOpacity style={styles.submitBtn} onPress={() => { Vibration.vibrate(10); submitReview(); }}>
                <Text style={styles.submitBtnText}>Відправити</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <FloatingChatButton bottomOffset={120} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  badge: { position: 'absolute', right: -6, top: -6, backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 8, lineHeight: 30 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  price: { fontSize: 32, fontWeight: '800', color: '#000' },
  oldPrice: { fontSize: 18, color: '#999', textDecorationLine: 'line-through', marginBottom: 6 },
  
  selectorGroup: { marginBottom: 20 },
  selectorTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: '#111' },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: '#000', borderColor: '#000' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#000' },
  chipTextActive: { color: '#fff' },
  tag: { marginLeft: 10, backgroundColor: '#E0E7FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { color: '#4F46E5', fontSize: 10, fontWeight: '700' },
  
  buyBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  buyBtnDisabled: { backgroundColor: '#ccc', shadowOpacity: 0 },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  advantages: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 12, marginBottom: 20 },
  advItem: { alignItems: 'center' },
  advText: { fontSize: 10, fontWeight: '600', color: '#555', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#eee', marginBottom: 20 },
  
  tabsScroll: { gap: 24, paddingBottom: 12, paddingHorizontal: 4 },
  tabItem: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.light.tint },
  tabText: { fontSize: 15, color: '#666' },
  tabTextActive: { color: Colors.light.tint, fontWeight: 'bold' },
  tabContent: { marginBottom: 30, minHeight: 80, paddingTop: 12 },
  htmlDescriptionWrap: { paddingVertical: 8 },
  staticBlock: { padding: 15 },
  staticHeading: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  staticPara: { fontSize: 14, color: '#555', marginBottom: 5 },
  staticBold: { fontWeight: 'bold' },
  staticItalic: { fontStyle: 'italic', marginBottom: 5 },
  descText: { fontSize: 15, lineHeight: 24, color: '#333' },
  
  sectionHeader: { fontSize: 20, fontWeight: '700', marginBottom: 15 },
  simCard: { width: 140, marginRight: 15, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  simImg: { width: '100%', height: 140, backgroundColor: '#f5f5f5' },
  simTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  simPrice: { fontSize: 14, fontWeight: 'bold' },
  
  reviewItem: { padding: 15, backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 10 },
  writeBtn: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, marginBottom: 15, backgroundColor: '#F9F9F9' },
  submitBtn: { backgroundColor: '#000', padding: 15, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold' }
});