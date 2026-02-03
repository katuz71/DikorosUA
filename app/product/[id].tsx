import { FloatingChatButton } from '@/components/FloatingChatButton';
import { ProductDetailsView } from '@/components/ProductDetailsView';
import { API_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { trackEvent } from '@/utils/analytics';
import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import { getImageUrl } from '@/utils/image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
  Modal,
  TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavoritesStore } from '../../store/favoritesStore';

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const productId = Number(Array.isArray(id) ? id[0] : id);
  console.warn("PDP id raw=", id);
  console.warn("PDP productId=", productId);
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, items: cartItems } = useCart();
  const { favorites, toggleFavorite } = useFavoritesStore();
  const { products: allProducts } = useOrders(); // Get all products for similar suggestions

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Similar products logic
  const similarProducts = useMemo(() => {
    if (!product || !allProducts.length) return [];
    return allProducts
      .filter(p => p.category === product.category && p.id !== product.id)
      .slice(0, 10); // Limit to 10 products
  }, [product, allProducts]);
  
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, user_name: '', comment: '' });
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const cartCount = cartItems.reduce((total: number, item: any) => total + (item.quantity || 1), 0);

  // --- Helpers ---
  const clean = (v: unknown) => String(v ?? "").trim().replace(/^"+|"+$/g, "").replace(/\s+/g, " ");
  
  const formatPrice = (price: number) => {
    return `${(price || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setToastVisible(false));
    }, 2000);
  };

  // --- Normalization ---
  const { optionKeys, internalKeys, variantRows, matrix } = useMemo(() => {
    if (!product) return { optionKeys: [], internalKeys: [], variantRows: [], matrix: {} };
    
    // 1. Get option headers (e.g., Weight|Form|Sort)
    const oKeys = clean(product.option_names).split('|').map(clean).filter(Boolean);
    const iKeys = oKeys.map((_, i) => `opt_${i}`);

    // 2. Parse variants
    let rawVariants: any[] = [];
    try {
      if (typeof product.variants === 'string') {
        const parsed = JSON.parse(product.variants);
        rawVariants = Array.isArray(parsed) ? parsed : [];
      } else if (Array.isArray(product.variants)) {
        rawVariants = product.variants;
      }
    } catch (e) { console.warn("Parse variants error", e); }

    // 3. Build rows
    const rows: any[] = [];
    rawVariants.forEach((v) => {
      const label = clean(v?.name || v?.variant || v?.title || v?.size || v?.pack_size || v?.packSize);
      if (!label) return;
      
      const parts = label.split('|').map(clean);
      while (parts.length < oKeys.length) parts.push("");
      
      const options: Record<string, string> = {};
      iKeys.forEach((ik, idx) => { options[ik] = parts[idx] || ""; });
      
      rows.push({
        raw: v,
        options,
        price: Number(v?.price ?? 0) || product.price || 0,
        old_price: Number(v?.old_price ?? 0) || undefined
      });
    });

    // 4. Matrix for selection UI
    const m: Record<string, string[]> = {};
    iKeys.forEach((ik) => {
      const values = new Set<string>();
      rows.forEach(r => { if (r.options[ik]) values.add(r.options[ik]); });
      m[ik] = Array.from(values);
    });

    return { optionKeys: oKeys, internalKeys: iKeys, variantRows: rows, matrix: m };
  }, [product]);

  // Current match
  const { activeRow, currentPrice, oldPrice } = useMemo(() => {
    const found = variantRows.find(r => 
      internalKeys.every(ik => clean(r.options[ik]) === clean(selectedOptions[ik]))
    );
    return {
      activeRow: found,
      currentPrice: found ? found.price : (product?.price || 0),
      oldPrice: found ? found.old_price : (product?.old_price || 0)
    };
  }, [variantRows, selectedOptions, product]);

  // Data Loading
  useEffect(() => {
    const fetchData = async () => {
      if (isNaN(productId)) {
        setError("Invalid Product ID");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      let url = `${API_URL}/products/${productId}`;
      try {
        let res = await fetch(url);
        console.warn(`PDP fetch url=${url} status=${res.status}`);
        
        // If 405 or 404, try alternative (some servers prefer query params or have prefix issues)
        if (res.status === 405 || res.status === 404) {
          const altUrl = `${API_URL}/products?id=${productId}`;
          console.warn(`PDP trying altUrl=${altUrl}`);
          const altRes = await fetch(altUrl);
          if (altRes.ok) {
             const allProducts = await altRes.json();
             const found = Array.isArray(allProducts) ? allProducts.find((p: any) => p.id === productId) : null;
             if (found) {
                setProduct(found);
                setLoading(false);
                return;
             }
          }
        }

        if (res.ok) {
          const data = await res.json();
          setProduct(data);
          
          // Initial selection logic (default to first available options)
          if (data.option_names) {
             // selection will be handled by next useEffect when internalKeys/matrix are updated
          }

          // Fetch reviews in parallel
          fetch(`${API_URL}/api/reviews/${productId}`)
            .then(r => r.ok ? r.json() : [])
            .then(setReviews)
            .catch(() => {});

        } else {
          setError(`Error loading product: ${res.status}`);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [productId]);

  // Set default selection when product/matrix loads
  useEffect(() => {
    if (product && internalKeys.length > 0 && Object.keys(selectedOptions).length === 0) {
      const first: Record<string, string> = {};
      internalKeys.forEach(ik => {
        if (matrix[ik] && matrix[ik][0]) first[ik] = matrix[ik][0];
      });
      setSelectedOptions(first);
    }
  }, [product, matrix, internalKeys]);

  const onShare = async () => {
    try {
      if (!product) return;
      await Share.share({
        message: `Дізнайтеся більше про ${product.name}: ${getImageUrl(product.image)}`,
        title: product.name
      });
    } catch (e) {}
  };

  const submitReview = async () => {
    if (!newReview.user_name || !newReview.comment) {
      Vibration.vibrate(50);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, ...newReview })
      });
      if (res.ok) {
        showToast('Дякуємо за відгук!');
        setReviewModalVisible(false);
        setNewReview({ rating: 5, user_name: '', comment: '' });
      }
    } catch (e) {}
  };

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color="#000" />
      <Text style={{ marginTop: 10 }}>Завантаження товару...</Text>
    </SafeAreaView>
  );

  if (error || !product) return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.errorText}>{error || "Товар не знайдено"} (ID: {productId})</Text>
      <TouchableOpacity onPress={() => router.back()} style={styles.mainBtn}>
        <Text style={styles.whiteText}>Назад</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const isFavorite = favorites.some(f => f.id === product.id);

  return (
    <SafeAreaView style={styles.container}>
       {/* Floating Header */}
       <View style={[styles.header, { paddingTop: insets.top + 5 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} style={styles.iconBtn}>
              <Ionicons name="cart-outline" size={22} color="#000" />
              {cartCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View> : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={onShare} style={styles.iconBtn}>
                <Ionicons name="share-outline" size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { toggleFavorite(product); showToast(isFavorite ? 'Видалено' : 'Додано'); }} style={styles.iconBtn}>
              <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#ef4444" : "#000"} />
            </TouchableOpacity>
          </View>
       </View>

       <ProductDetailsView 
          product={product}
          variantRows={variantRows}
          optionKeys={optionKeys}
          internalKeys={internalKeys}
          matrix={matrix}
          selectedOptions={selectedOptions}
          setSelectedOptions={setSelectedOptions}
          currentPrice={currentPrice}
          oldPrice={oldPrice}
          activeRow={activeRow}
          formatPrice={formatPrice}
          clean={clean}
          onAddToCart={() => {
            Vibration.vibrate(10);
            const selections = internalKeys.map(k => selectedOptions[k]).filter(Boolean).join(' | ');
            addItem(product, 1, selections || 'шт', selections || product.unit || 'шт', currentPrice);
            showToast('Додано в кошик');
            trackEvent('AddToCart', { content_ids: [product.id], value: currentPrice, currency: 'UAH' });
            logFirebaseEvent('add_to_cart', { item_id: product.id, item_name: product.name, value: currentPrice });
          }}
          onToggleFavorite={() => toggleFavorite(product)}
          isFavorite={isFavorite}
          onShare={onShare}
          reviews={reviews}
          totalReviews={reviews.length}
          averageRating={reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0}
          onWriteReview={() => setReviewModalVisible(true)}
          
          similarProducts={similarProducts}
          onSimilarProductPress={(id: number) => router.push(`/product/${id}`)}
          onSimilarProductAddToCart={(p: any) => {
             // Simple add to cart for similar list (default variant)
             Vibration.vibrate(10);
             addItem(p, 1, p.pack_sizes?.[0] || 'шт', p.unit || 'шт', p.price);
             showToast('Додано в кошик');
             trackEvent('AddToCart', { content_ids: [p.id], value: p.price, currency: 'UAH' });
             logFirebaseEvent('add_to_cart', { item_id: p.id, item_name: p.name, value: p.price });
          }}
          onSimilarProductToggleFavorite={(p: any) => {
             toggleFavorite(p);
             // We don't show toast here to avoid clutter or maybe we should?
             // showToast(favorites.some(f => f.id === p.id) ? 'Видалено' : 'Додано'); // State not updated yet
          }}
          favorites={favorites}
       />

       <Modal visible={reviewModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
             <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                   <Text style={styles.modalTitle}>Написати відгук</Text>
                   <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                      <Ionicons name="close" size={24} color="#000" />
                   </TouchableOpacity>
                </View>
                <TextInput placeholder="Ваше ім'я" style={styles.input} value={newReview.user_name} onChangeText={t => setNewReview({...newReview, user_name: t})} />
                <TextInput placeholder="Ваш відгук" multiline numberOfLines={4} style={[styles.input, { height: 100 }]} value={newReview.comment} onChangeText={t => setNewReview({...newReview, comment: t})} />
                <TouchableOpacity onPress={submitReview} style={styles.submitBtn}>
                   <Text style={styles.whiteText}>Відправити</Text>
                </TouchableOpacity>
             </View>
          </View>
       </Modal>

       {toastVisible && (
         <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
           <Text style={styles.whiteText}>{toastMessage}</Text>
         </Animated.View>
       )}
       
       <FloatingChatButton bottomOffset={90} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)' },
  headerRight: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#DC2626', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  mainBtn: { backgroundColor: '#000', padding: 15, borderRadius: 12, marginTop: 20 },
  whiteText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  errorText: { fontSize: 16, color: '#666', textAlign: 'center', paddingHorizontal: 20 },
  toast: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(30,30,30,0.9)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, zIndex: 1000 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 15, fontSize: 15 },
  submitBtn: { backgroundColor: '#000', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
});
