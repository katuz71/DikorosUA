import { FloatingChatButton } from '@/components/FloatingChatButton';
import ProductInfo from '@/components/ProductInfo';
import { Colors } from '@/constants/theme';
import { API_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { trackEvent, trackViewItem, trackAddToCart } from '@/utils/analytics';
import { addToHistory } from '@/app/utils/history';
import { ensureHttps, getImageUrl, parseImages } from '@/utils/image';
// Импорт парсера удален, так как используется новая структура бэкенда.
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavoritesStore } from '../../store/favoritesStore';
import { ProductBadges } from '@/components/ProductBadges';

// Утилита нормализации (для локального использования)
const normalize = (str: string | number | undefined) => {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, ''); 
};

// Конвертирует базовые HTML теги (списки) в Markdown, а остальные удаляет
const convertHtmlToMarkdown = (html: string): string => {
  if (!html || !html.trim()) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    // Удалены переводы в звездочки, просто убираем все не нужное
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '') // remove all remaining tags like <font>, <strong>, etc
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const normalizeWeight = (w: string) => {
  if (!w) return '';
  let res = w.toLowerCase().trim().replace(/\s+/g, ' ');
  // "грамм" -> "г", "грам" -> "г" и т.д.
  res = res.replace(/(грамм|грама|грам|гр|g|г\.)$/i, 'г');
  // Добавляем пробел перед "г", если его нет (50г -> 50 г)
  res = res.replace(/(\d+)\s*(г|кг|мл|л)$/i, '$1 $2');
  return res;
};

const parseVariantData = (variantName: string, productName: string) => {
  if (!variantName) return { weight: 'Стандарт', form: 'Стандарт', grade: 'Стандарт' };

  // 1. Извлечение веса
  const weightRegex = /(\d+(?:[\.,]\d+)?)\s*(г|кг|мл|л|грамм|грама|грам|гр|ml|g|kg)(?:\s|$|[.,\-])/i;
  const wMatch = variantName.match(weightRegex);
  let weight = 'Стандарт';
  let rawWeightStr = '';

  if (wMatch) {
    rawWeightStr = wMatch[0];
    weight = rawWeightStr.toLowerCase().replace(/\s+/g, ' ').replace(/(грамм|грама|грам|гр|g)$/i, 'г').replace(/(\d+)(г|кг|мл|л)/i, '$1 $2').trim();
  }

  // 2. Отсечение префикса (Diff)
  let featureStr = variantName;
  if (rawWeightStr) featureStr = featureStr.replace(rawWeightStr, '');
  const cleanWord = (w: string) => w.replace(/[(),\-.]/g, '').toLowerCase();
  const vWords = featureStr.split(/\s+/).filter(w => w.length > 0);
  const pWords = (productName || '').replace(weightRegex, '').split(/\s+/).filter(w => w.length > 0);

  let diffIndex = 0;
  while (diffIndex < vWords.length && diffIndex < pWords.length) {
    if (cleanWord(vWords[diffIndex]) === cleanWord(pWords[diffIndex])) diffIndex++;
    else break;
  }
  let diffStr = vWords.slice(diffIndex).join(' ').replace(/^[(),\-\s]+|[(),\-\s]+$/g, '').trim();

  // 3. Безопасный поиск Формы и Сорта (с кастомными кириллическими границами)
  let form = 'Стандарт';
  let grade = 'Стандарт';

  const formRegex = /(^|[\s,.\-()])(лом|порошок)([\s,.\-()]|$)/i;
  const formMatch = diffStr.match(formRegex);
  if (formMatch) {
    form = formMatch[2].toLowerCase();
    form = form.charAt(0).toUpperCase() + form.slice(1);
    diffStr = diffStr.replace(formMatch[0], ' ').trim();
  }

  const gradeRegex = /(^|[\s,.\-()])(1\s*сорт|2\s*сорт|еліт|елит|сорт\s*еліт)([\s,.\-()]|$)/i;
  const gradeMatch = diffStr.match(gradeRegex);
  if (gradeMatch) {
    grade = gradeMatch[2].toLowerCase();
    if (grade.includes('еліт') || grade.includes('елит')) grade = 'Еліт';
    else grade = grade.charAt(0).toUpperCase() + grade.slice(1);
    diffStr = diffStr.replace(gradeMatch[0], ' ').trim();
  }

  diffStr = diffStr.replace(/^[(),\-\s]+|[(),\-\s]+$/g, '').trim();

  // Если остался текст (например "Зі смаком вишні" у мишек)
  if (diffStr.length > 0) {
    diffStr = diffStr.charAt(0).toUpperCase() + diffStr.slice(1);
    if (form === 'Стандарт') form = diffStr;
    else form = `${form} ${diffStr}`;
  }

  // Логика по умолчанию: если есть Сорт, но нет Формы, значит это целые грибы
  if (form === 'Стандарт' && grade !== 'Стандарт') {
    form = 'Цілі';
  }

  return { weight, form, grade };
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
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const [product, setProduct] = useState<any>(null);
  const [productDetail, setProductDetail] = useState<any>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRequestRef = useRef<number | null>(null);
  const viewItemSentRef = useRef<number | null>(null);
  const addedToHistoryRef = useRef<number | null>(null);

  // --- LOGGING AND GROUPING ---
  const safeVariants = productDetail?.variants || product?.variants || [];
  
  const groupedVariants = useMemo(() => {
    if (!safeVariants || safeVariants.length === 0) return {};
    const grouped: { [key: string]: any[] } = {};
    safeVariants.forEach((v: any) => {
      const { weight, form, grade } = parseVariantData(v.name || v.sku || '', (productDetail || product)?.name || '');
      if (!grouped[weight]) grouped[weight] = [];
      grouped[weight].push({ ...v, weight, form, grade });
    });
    return grouped;
  }, [safeVariants, productDetail?.name, product?.name]);

  const uniqueWeights = useMemo(() => Object.keys(groupedVariants), [groupedVariants]);

  // --- STATE ВЫБОРА ---
  const [selectedWeight, setSelectedWeight] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  const handleWeightSelect = (w: string) => {
    setSelectedWeight(w);
    const variantsForWeight = groupedVariants[w] || [];
    if (variantsForWeight.length > 0) {
      const firstForm = variantsForWeight[0].form || 'Стандарт';
      setSelectedForm(firstForm);
      const variantsForForm = variantsForWeight.filter((v: any) => (v.form || 'Стандарт') === firstForm);
      if (variantsForForm.length > 0) {
        setSelectedGrade(variantsForForm[0].grade || 'Стандарт');
        setSelectedVariant(variantsForForm[0]);
      }
    }
    Vibration.vibrate(10);
  };

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
    addedToHistoryRef.current = null;

    setSelectedWeight(null);
    setSelectedForm(null);
    setSelectedGrade(null);
    setSelectedVariant(null);
    setCurrentPrice(0);

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

  // Отправка view_item один раз при успешной загрузке карточки товара (GA4 e-commerce)
  useEffect(() => {
    if (!productDetail?.id || viewItemSentRef.current === productDetail.id) return;
    // Дожидаемся установки цены (для товаров с вариантами — из resolver)
    const price = currentPrice || Number(productDetail.price) || 0;
    if (price === 0 && Number(productDetail.price) !== 0) return;
    viewItemSentRef.current = productDetail.id;
    trackViewItem({
      id: productDetail.id,
      name: productDetail.name,
      title: productDetail.name,
      price,
      category: productDetail.category || 'general',
    });
  }, [productDetail?.id, productDetail?.name, productDetail?.price, productDetail?.category, currentPrice]);

  // Зберегти товар в історію перегляду (AsyncStorage)
  useEffect(() => {
    const p = productDetail || product;
    if (!p?.id) return;
    if (addedToHistoryRef.current === p.id) return;
    addedToHistoryRef.current = p.id;
    const price = currentPrice || Number(p.price) || 0;
    addToHistory({
      id: p.id,
      name: p.name,
      price,
      image: p.image,
      image_url: p.image_url,
      picture: p.picture,
      category: p.category,
    }).catch(() => {});
  }, [productDetail, product, currentPrice]);

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

  // --- 2. ОБНОВЛЕНИЕ ВАРИАНТА ПРИ ЗАГРУЗКЕ ---
  useEffect(() => {
    const dataSource = productDetail || product;
    if (selectedVariant) {
      setCurrentPrice(selectedVariant.price || dataSource?.price || 0);
    } else if (dataSource) {
      setCurrentPrice(dataSource.price || 0);
    }
  }, [selectedVariant, productDetail, product]);

  // Зберегти початкові значення при завантаженні (якщо ще не обрано)
  useEffect(() => {
    if (uniqueWeights.length > 0 && !selectedWeight) {
      handleWeightSelect(uniqueWeights[0]);
    }
  }, [uniqueWeights]);

  // --- 3. ДЕЙСТВИЯ ---
  const handleAddToCart = () => {
    if (!productDetail || !productDetail.id) {
      showToast('Завантаження...');
      return;
    }

    Vibration.vibrate(10);

    const packSize = selectedVariant?.weight || productDetail.unit || 'шт';
    const itemToAdd = selectedVariant
       ? { 
           ...productDetail, 
           id: selectedVariant.id, 
           sku: selectedVariant.sku || productDetail.sku, 
           price: selectedVariant.price, 
           name: selectedVariant.name || productDetail.name 
         }
       : { 
           ...productDetail, 
           sku: productDetail.sku,
           price: currentPrice 
         };

    addItem(itemToAdd, 1, packSize, productDetail.unit || 'шт', currentPrice);
    trackEvent('AddToCart', { content_ids: [itemToAdd.id], content_type: 'product', value: currentPrice, currency: 'UAH', content_name: itemToAdd.name });
    trackAddToCart(itemToAdd, 1);
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

  // Цена для отображения - именно selectedVariant.price
  const displayOldPrice = selectedVariant?.old_price || productDetail?.old_price;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 80 + insets.top }} showsVerticalScrollIndicator={false} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })} scrollEventThrottle={16}>
        {/* CAROUSEL */}
        <View style={{ position: 'relative' }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: screenWidth }}>
            {(() => {
              const images = parseImages(displayProduct.images);
              const fallbackImages = [displayProduct.image || displayProduct.image_url].filter(Boolean);
              const displayImages = images.length > 0 ? images : fallbackImages;
              return displayImages.map((img: string, i: number) => {
                const imageUrl = img
                  ? ensureHttps(img.startsWith('http') ? img : `${API_URL}${img.startsWith('/') ? '' : '/'}${img}`)
                  : null;
                return (
                  <Image
                    key={i}
                    source={{ uri: imageUrl || 'https://via.placeholder.com/300' }}
                    style={{ width: screenWidth, height: 350, backgroundColor: '#f5f5f5' }}
                    contentFit="contain"
                  />
                );
              });
            })()}
          </ScrollView>
          
          <ProductBadges 
            product={displayProduct} 
            containerStyle={{ top: 12, left: 12 }} 
          />
        </View>

        <View style={{ padding: 20 }}>
          {(() => {
            let title = displayProduct?.name;
            if (!title || title.trim() === 'Без назви' || title.trim() === '') {
              title = safeVariants[0]?.name || 'Товар';
            }
            return <Text style={styles.title}>{title}</Text>;
          })()}
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

          {/* VARIANT SELECTION (UNIVERSAL 2-LEVEL) */}
          {safeVariants.length > 0 && uniqueWeights.filter(w => w !== 'Стандарт' && w !== '').length > 1 && (
            <View style={styles.selectorGroup}>
              <Text style={styles.selectorTitle}>Вага / Об'єм</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {uniqueWeights.map((w) => (
                  <TouchableOpacity
                    key={w}
                    onPress={() => handleWeightSelect(w)}
                    style={[styles.chip, selectedWeight === w && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedWeight === w && styles.chipTextActive]}>
                      {w}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Блок 2: Форма / Вид */}
          {safeVariants.length > 1 && (() => {
            const currentVariants = groupedVariants[selectedWeight || ''] || [];
            const uniqueForms = Array.from(new Set(currentVariants.map((v: any) => v.form || 'Стандарт')));
            const validForms = uniqueForms.filter((f: any) => f !== 'Стандарт' && f !== '');
            if (validForms.length <= 1) return null;

            return (
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorTitle}>Форма / Вид</Text>
                <View style={styles.selectorRow}>
                  {validForms.map((fName: any, index: number) => (
                    <TouchableOpacity
                      key={`form-${index}`}
                      onPress={() => { 
                        setSelectedForm(fName); 
                        // Авто-выбор первого доступного сорта для этой формы
                        const gradesForThisForm = currentVariants.filter((v:any) => v.form === fName);
                        if (gradesForThisForm.length > 0) {
                          setSelectedGrade(gradesForThisForm[0].grade);
                          setSelectedVariant(gradesForThisForm[0]);
                        }
                        Vibration.vibrate(10); 
                      }}
                      style={[styles.chip, selectedForm === fName && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selectedForm === fName && styles.chipTextActive]}>{fName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* Блок 3: Сорт / Якість */}
          {safeVariants.length > 1 && (() => {
            const currentVariants = groupedVariants[selectedWeight || ''] || [];
            const variantsForForm = currentVariants.filter((v: any) => (v.form || 'Стандарт') === (selectedForm || 'Стандарт'));
            const uniqueGrades = Array.from(new Set(variantsForForm.map((v: any) => v.grade || 'Стандарт')));
            const validGrades = uniqueGrades.filter((g: any) => g !== 'Стандарт' && g !== '');
            if (validGrades.length <= 1) return null;

            return (
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorTitle}>Сорт / Якість</Text>
                <View style={styles.selectorRow}>
                  {validGrades.map((gName: any, index: number) => (
                    <TouchableOpacity
                      key={`grade-${index}`}
                      onPress={() => { 
                        setSelectedGrade(gName); 
                        const exactVariant = variantsForForm.find((v:any) => v.grade === gName);
                        if (exactVariant) setSelectedVariant(exactVariant);
                        Vibration.vibrate(10); 
                      }}
                      style={[styles.chip, selectedGrade === gName && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selectedGrade === gName && styles.chipTextActive]}>{gName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* BUTTON */}
          <Pressable 
            style={[styles.buyBtn, (!isDetailReady) && styles.buyBtnDisabled]}
            disabled={!isDetailReady}
            onPress={handleAddToCart}
          >
            <Text style={styles.buyBtnText}>
                {!isDetailReady ? 'Завантаження...' : 'В кошик'}
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
              return (
                <View style={[styles.markdownDescriptionWrap, { paddingHorizontal: 20 }]}>
                  <Markdown style={markdownStyles} mergeStyle={true}>
                    {convertHtmlToMarkdown(desc)}
                  </Markdown>
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
                 {products.filter(p => p.category === displayProduct?.category && p.id !== displayProduct?.id).slice(0, 10).map(p => {
                         const imgPath = p.image || p.image_url;
                         const imageUrl = imgPath
                           ? ensureHttps(imgPath.startsWith('http') ? imgPath : `${API_URL}${imgPath.startsWith('/') ? '' : '/'}${imgPath}`)
                           : null;
                         return (
                         <TouchableOpacity key={p.id} onPress={() => router.push(`/product/${p.id}`)} style={styles.simCard}>
                             <Image source={{ uri: imageUrl || 'https://via.placeholder.com/300' }} style={styles.simImg} contentFit="cover" />
                             <View style={{padding:8}}><Text numberOfLines={2} style={styles.simTitle}>
                                  {(() => {
                                    let dt = p.name;
                                    if (!dt || dt.trim() === 'Без назви' || dt.trim() === '') {
                                      dt = (p.variants && p.variants.length > 0 && p.variants[0].name) ? p.variants[0].name : 'Товар';
                                    }
                                    return dt;
                                  })()}
                                </Text><Text style={styles.simPrice}>{formatPrice(p.price)}</Text></View>
                         </TouchableOpacity>
                         );
                     })}
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
  selectorTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#111' },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 10, 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  chipActive: { 
    backgroundColor: Colors.light.tint, 
    borderColor: Colors.light.tint,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '800' },
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
  markdownDescriptionWrap: { paddingVertical: 8 },
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

const markdownStyles = {
  heading1: { fontWeight: '700' as const, color: '#000' },
  heading2: { fontWeight: '700' as const, color: '#000' },
  paragraph: { marginBottom: 10, fontSize: 16, lineHeight: 24, color: '#444' },
  bullet_list: { marginLeft: 16, marginBottom: 10 },
  ordered_list: { marginLeft: 16, marginBottom: 10 },
  list_item: { marginBottom: 4 },
  bullet_list_icon: { marginLeft: 0, marginRight: 8 },
  ordered_list_icon: { marginLeft: 0, marginRight: 8 },
  body: { fontSize: 16, lineHeight: 24, color: '#444' },
  strong: { fontWeight: '700' as const, color: '#1a1a1a' },
};