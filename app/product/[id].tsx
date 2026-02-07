import { FloatingChatButton } from '@/components/FloatingChatButton';
import { API_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { trackEvent } from '@/utils/analytics';
import { getImageUrl, parseImages } from '@/utils/image';
// Импорт парсера
import { ParsedVariant, parseVariants } from '@/utils/productParser';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavoritesStore } from '../../store/favoritesStore';

// Утилита нормализации (для локального использования)
const normalize = (str: string | number | undefined) => {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, ''); 
};

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addToCart, addItem, items: cartItems } = useCart();
  const { products } = useOrders(); // Здесь лежат все товары
  const { favorites, toggleFavorite } = useFavoritesStore();
  const insets = useSafeAreaInsets();

  const cartCount = cartItems.reduce((total: number, item: any) => total + (item.quantity || 1), 0);
  const { width: screenWidth } = Dimensions.get('window');
  const scrollY = useRef(new Animated.Value(0)).current;
  const [activeImage, setActiveImage] = useState(0);
  
  const [product, setProduct] = useState<any>(null);
  
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
    if (!id || !products || products.length === 0) return;
    const productId = Number(Array.isArray(id) ? id[0] : id);
    const found = products.find((p: any) => p.id === productId);
    if (found) {
      setProduct(found);
      trackEvent('ViewContent', { content_ids: [found.id], content_type: 'product', value: found.price, currency: 'UAH', content_name: found.name });
    }
  }, [products, id]);

  const loadReviews = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/reviews/${id}`);
      if (res.ok) setReviews(await res.json());
    } catch (e) {}
  }, [id]);
  useEffect(() => { loadReviews(); }, [loadReviews]);

  // --- 2. ИСПОЛЬЗУЕМ ПАРСЕР (ВМЕСТО ГРЯЗНОЙ ЛОГИКИ) ---
  const { variants: allVariants, mode: variantMode } = useMemo(() => {
      return parseVariants(product, products); 
  }, [product, products]);

  // --- 3. UI СПИСКИ ---
  useEffect(() => {
    
    if (!allVariants.length) return;

    if (variantMode === 'complex') {
        const grades = Array.from(new Set(allVariants.map((v: ParsedVariant) => v.grade))).sort();
        const types = Array.from(new Set(allVariants.map((v: ParsedVariant) => v.type))).sort();
        const weights = Array.from(new Set(allVariants.map((v: ParsedVariant) => v.weight))).sort((a: string, b: string) => {
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
  }, [allVariants, variantMode]);

  // --- 4. RESOLVER (ПОИСК) ---
  useEffect(() => {
      if (variantMode === 'none') {
          // Одиночный товар
          setResolvedVariant(null);
          setCurrentPrice(product?.price || 0);
          return;
      }

      let found: ParsedVariant | undefined;

      if (variantMode === 'simple') {
          const target = normalize(selectedSimpleOption);
          found = allVariants.find((v: ParsedVariant) => v.normWeight === target);
      } else {
          // Complex: форма (type) не влияет на цену, только сорт + вага
          const tGrade = normalize(selectedGrade);
          const tType = normalize(selectedType);
          const tWeight = normalize(selectedWeight);

          // Ищем по Сорт + Вага (форма игнорируется для pricing)
          found = allVariants.find((v: ParsedVariant) => 
            v.normGrade === tGrade && v.normWeight === tWeight
          );
          
          // Жорстко прописані ціни для 1 сорта (якщо в базі немає)
          if (!found && selectedGrade === '1 сорт') {
            const hardcodedPrices: { [key: string]: number } = {
              '1г': 8.5,
              '50г': 425,
              '100г': 850,
              '200г': 1615
            };
            
            const price = hardcodedPrices[selectedWeight];
            if (price) {
              // Створюємо віртуальний варіант для 1 сорта
              found = {
                id: product.id,
                price,
                title: `${product.name} (1 сорт | ${selectedWeight})`,
                grade: '1 сорт',
                type: selectedType,
                weight: selectedWeight,
                normGrade: tGrade,
                normType: tType,
                normWeight: tWeight,
                isComplex: true,
                origVariant: null
              };
            }
          }
      }

      setResolvedVariant(found || null);
      if (found) setCurrentPrice(found.price);
      else setCurrentPrice(product?.price || 0);

  }, [selectedGrade, selectedType, selectedWeight, selectedSimpleOption, allVariants, variantMode, product]);

  // --- ДЕЙСТВИЯ ---
  const handleAddToCart = () => {
    let finalName = product.name;
    let finalId = product.id;

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
                finalName = `${product.name} (${selectedGrade} | ${selectedType} | ${selectedWeight})`;
            } else {
                finalName = `${product.name} (${selectedSimpleOption})`;
            }
        }
    }
    
    const packSize = variantMode === 'complex' ? selectedWeight : (selectedSimpleOption || 'шт');
    const itemToAdd = { ...product, id: finalId, price: currentPrice, name: finalName };
    
    addItem(itemToAdd, 1, packSize, product.unit || 'шт', currentPrice);
    trackEvent('AddToCart', { content_ids: [finalId], content_type: 'product', value: currentPrice, currency: 'UAH', content_name: finalName });
    showToast('Додано в кошик');
  };

  const handleCarouselScroll = (event: any) => {
    const slideWidth = screenWidth;
    const currentIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActiveImage(currentIndex);
  };

  const submitReview = async () => {
    if (!newReview.user_name.trim()) { showToast('Введіть ваше ім\'я'); return; }
    if (!newReview.comment.trim()) { showToast('Напишіть відгук'); return; }
    try {
      const response = await fetch(`${API_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: parseInt(id as string), user_name: newReview.user_name, user_phone: newReview.user_phone, rating: newReview.rating, comment: newReview.comment })
      });
      if (response.ok) {
        showToast('Дякуємо за відгук!');
        setReviewModalVisible(false);
        setNewReview({ rating: 5, user_name: '', user_phone: '', comment: '' });
        loadReviews();
      } else { showToast('Помилка при відправці відгуку'); }
    } catch (error) { showToast('Помилка при відправці відгуку'); }
  };

  const handleTabPress = (tabKey: string) => {
    setActiveTab(tabKey);
    const xPosition = tabLayouts.current[tabKey] || 0;
    tabsScrollViewRef.current?.scrollTo({ x: Math.max(0, xPosition - 50), animated: true });
  };

  const handleToggleFavorite = () => {
    if (!product?.id) return;
    toggleFavorite({ ...product, price: currentPrice });
    const isNowFavorite = favorites.some(fav => fav.id === product.id);
    showToast(isNowFavorite ? "Видалено з обраного" : "Додано в обране ❤️");
  };

  const handleShare = async () => {
    if (!product) return;
    try { Vibration.vibrate(10); await Share.share({ message: `${product.name}\n${formatPrice(currentPrice)}`, title: product.name }); } catch (error) {}
  };

  // --- RENDER ---
  if (!product?.id) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#000" />;

  const headerOpacity = scrollY.interpolate({ inputRange: [0, 50], outputRange: [0.7, 1], extrapolate: 'clamp' });
  const headerBorderWidth = scrollY.interpolate({ inputRange: [0, 50], outputRange: [0, 1], extrapolate: 'clamp' });

  // Цена для отображения
  const displayOldPrice = resolvedVariant?.old_price || product.old_price;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* HEADER */}
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, width: '100%', paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: headerBorderWidth, borderBottomColor: '#eee', height: 60 + insets.top }}>
        <Animated.View style={{ position: 'absolute', inset: 0, opacity: headerOpacity }}>
          <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.8)']} style={{ flex: 1 }} />
        </Animated.View>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color="#000" /></TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 15 }}>
          <TouchableOpacity onPress={() => router.push('/cart')} style={styles.iconBtn}>
            <Ionicons name="cart-outline" size={24} color="#000" />
            {cartCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleFavorite} style={styles.iconBtn}>
            <Ionicons name={favorites.some(fav => fav.id === product?.id) ? "heart" : "heart-outline"} size={24} color={favorites.some(fav => fav.id === product?.id) ? "#e74c3c" : "#000"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}><Ionicons name="share-outline" size={24} color="#000" /></TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 80 + insets.top }} showsVerticalScrollIndicator={false} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })} scrollEventThrottle={16}>
        {/* CAROUSEL */}
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleCarouselScroll} scrollEventThrottle={16} style={{ width: screenWidth }}>
            {(() => {
              const images = parseImages(product.images);
              const fallbackImages = [product.image || product.image_url].filter(Boolean);
              const displayImages = images.length > 0 ? images : fallbackImages;
              return displayImages.map((img: string, i: number) => (
                <Image key={i} source={{ uri: getImageUrl(img) }} style={{ width: screenWidth, height: 350, backgroundColor: '#f5f5f5' }} resizeMode="cover" />
              ));
            })()}
          </ScrollView>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={styles.title}>{product.name}</Text>
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
             <Text style={styles.price}>{formatPrice(currentPrice)}</Text>
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
            style={[styles.buyBtn, (!resolvedVariant && variantMode !== 'none' && allVariants.length > 1) && styles.buyBtnDisabled]}
            disabled={!resolvedVariant && variantMode !== 'none' && allVariants.length > 1}
            onPress={handleAddToCart}
          >
            <Text style={styles.buyBtnText}>
                {(!resolvedVariant && variantMode !== 'none' && allVariants.length > 1) ? 'Недоступно' : 'В кошик'}
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
             {[{k:'description',l:'Опис'},{k:'instruction',l:'Інструкція'},{k:'delivery',l:'Доставка'},{k:'return',l:'Повернення'}].map(t => (
                 <TouchableOpacity key={t.k} onPress={() => handleTabPress(t.k)} onLayout={(e) => tabLayouts.current[t.k] = e.nativeEvent.layout.x} style={[styles.tabItem, activeTab === t.k && styles.tabItemActive]}>
                     <Text style={[styles.tabText, activeTab === t.k && styles.tabTextActive]}>{t.l}</Text>
                 </TouchableOpacity>
             ))}
          </ScrollView>
          <View style={{ marginBottom: 30, minHeight: 80, paddingHorizontal: 4 }}>
             <Text style={styles.descText}>
                 {activeTab === 'description' ? (product.description || 'Опис відсутній') : 
                  activeTab === 'instruction' ? (product.usage || 'Інформація відсутня') :
                  activeTab === 'delivery' ? (product.delivery_info || 'Доставка Новою Поштою') : (product.return_info || 'Згідно закону')}
             </Text>
          </View>

          {/* SIMILAR */}
          {products.filter(p => p.category === product?.category && p.id !== product?.id).length > 0 && (
             <View style={{ marginBottom: 30 }}>
                 <Text style={styles.sectionHeader}>Схожі товари</Text>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                     {products.filter(p => p.category === product?.category && p.id !== product?.id).slice(0, 10).map(p => (
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
             <TouchableOpacity style={styles.writeBtn} onPress={() => setReviewModalVisible(true)}>
                 <Text style={{fontWeight:'600'}}>Написати відгук</Text>
             </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Написати відгук</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}><Ionicons name="close" size={24} color="#000" /></TouchableOpacity>
            </View>
            <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
               {[1,2,3,4,5].map(s => (
                   <TouchableOpacity key={s} onPress={() => setNewReview({...newReview, rating: s})}>
                       <Ionicons name={s <= newReview.rating ? "star" : "star-outline"} size={32} color="#FBBF24" />
                   </TouchableOpacity>
               ))}
            </View>
            <TextInput style={styles.input} placeholder="Ваше ім'я" value={newReview.user_name} onChangeText={t => setNewReview({...newReview, user_name: t})} />
            <TextInput style={[styles.input, {minHeight:100}]} placeholder="Коментар" multiline value={newReview.comment} onChangeText={t => setNewReview({...newReview, comment: t})} />
            <TouchableOpacity style={styles.submitBtn} onPress={submitReview}><Text style={styles.submitBtnText}>Відправити</Text></TouchableOpacity>
          </View>
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
  
  buyBtn: { backgroundColor: '#000', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 25 },
  buyBtnDisabled: { backgroundColor: '#ccc' },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  advantages: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 12, marginBottom: 20 },
  advItem: { alignItems: 'center' },
  advText: { fontSize: 10, fontWeight: '600', color: '#555', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#eee', marginBottom: 20 },
  
  tabsScroll: { gap: 20, paddingBottom: 10 },
  tabItem: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#000' },
  tabText: { fontSize: 15, color: '#666' },
  tabTextActive: { color: '#000', fontWeight: 'bold' },
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