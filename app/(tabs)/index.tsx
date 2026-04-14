import { FloatingChatButton } from '@/components/FloatingChatButton';
import ProductCardSmall from '@/components/ProductCardSmall';
import { Colors } from '@/constants/theme';
import { API_URL, SERVER_URL } from '@/config/api';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { getImageUrl } from '@/utils/image';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from 'expo-image';
import { ActivityIndicator, Animated, Dimensions, FlatList, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getProductBadges } from '@/components/ProductBadges';
import { getHistory } from '@/utils/history';
import { useFocusEffect } from '@react-navigation/native';
import { useCategories } from '@/context/CategoriesContext';

const BANNER_GAP = 20;

const BannerImage = ({ uri, width, height }: { uri: string; width: number; height: number }) => {
  const [error, setError] = useState(false);
  if (error || !uri) {
    return (
      <View style={[styles.bannerPlaceholder, { width, height }]}>
        <Ionicons name="image-outline" size={40} color="#ccc" />
      </View>
    );
  }
  return (
    <Image 
      source={{ uri }} 
      style={{ width, height, borderRadius: 12, marginRight: BANNER_GAP }} 
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setError(true)}
    />
  );
};

// --- SUB-COMPONENTS FOR HOME PAGE ---

const CategoriesSection = ({ categories }: { categories: any[] }) => {
  const router = useRouter();
  if (!categories || categories.length === 0) return null;

  return (
    <View style={[styles.section, { marginTop: 15 }]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      >
        {categories?.map((item: any) => (
          <TouchableOpacity
            key={item?.id || Math.random().toString()}
            style={styles.categoryBadge}
            onPress={() => router.push({
              pathname: '/category/[id]',
              params: { 
                id: String(item.id), 
                name: item.name, 
                banner_url: item.banner_url || '', 
                banners: JSON.stringify(item.banners || []) 
              }
            })}
          >
            <Text style={styles.categoryBadgeText}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const RecentlyViewed = ({ products }: { products: any[] }) => {
  const router = useRouter();
  if (!products || products.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Останні переглянуті</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      >
        {products.map((item, idx) => {
          const imgUri = getImageUrl(item.image || item.image_url || item.picture, { width: 160, height: 160, quality: 70 });
          return (
            <TouchableOpacity
              key={`hist-${item.id}-${idx}`}
              onPress={() => router.push(`/product/${item.id}`)}
              style={styles.recentlyViewedThumb}
            >
              <Image source={{ uri: imgUri }} style={styles.recentlyViewedImage} contentFit="cover" cachePolicy="memory-disk" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const ProductSection = ({ title, products, onCartPress }: { title: string; products: any[]; onCartPress: (item: any, variant?: any) => void }) => {
  const router = useRouter();
  if (!products || products.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.productsListContent}
        renderItem={({ item }) => (
          <View style={styles.productCardWrapper}>
            <ProductCardSmall
              item={item}
              onPress={() => router.push(`/product/${item.id}`)}
              onCartPress={(variant) => onCartPress(item, variant)}
              cardWidth={160}
            />
          </View>
        )}
      />
    </View>
  );
};

const BlogSection = () => {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadBlog = async () => {
      try {
        setLoading(true);
        const baseUrl = API_URL.replace(/\/api$/, '');
        const res = await fetch(`${baseUrl}/posts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('Blog load error:', e);
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadBlog();
    return () => { cancelled = true; };
  }, []);

  if (!loading && posts.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Блог Дико-Корисно</Text>
      {loading ? (
        <View style={{ paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={Colors.light.tint} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 16 }}
        >
          {posts.map((post) => (
            <TouchableOpacity
              key={post.id}
              activeOpacity={0.85}
              style={styles.blogCard}
              onPress={() => router.push(`/blog/${post.id}`)}
            >
              <Image
                source={{ uri: post.image_url ? getImageUrl(post.image_url, { width: 280, height: 160, quality: 80 }) : getImageUrl(null) }}
                style={styles.blogCardImage}
                contentFit="cover"
              />
              <View style={styles.blogCardContent}>
                <Text style={styles.blogCardTitle} numberOfLines={2}>{post.title}</Text>
                {post.created_at && (
                  <Text style={styles.blogCardDate}>
                    {new Date(post.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default function Index() {
  const router = useRouter();
  const { addItem, items: cartItems } = useCart();
  const { products, isLoading, fetchProducts } = useOrders();
  const { categories } = useCategories();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bannerRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);

  // 1. БЕЗОПАСНАЯ ФИЛЬТРАЦИЯ
  const safeProducts = Array.isArray(products) ? products : [];
  
  const hitProducts = useMemo(() => 
    safeProducts.filter(p => getProductBadges(p).some(b => b.id === 'hit')), 
  [safeProducts]);

  const promoProducts = useMemo(() => 
    safeProducts.filter(p => getProductBadges(p).some(b => b.id === 'discount')), 
  [safeProducts]);

  const newProducts = useMemo(() => 
    safeProducts.filter(p => getProductBadges(p).some(b => b.id === 'new')), 
  [safeProducts]);

  useEffect(() => {
    if (products && products.length > 0) {
      console.log('📦 Products loaded:', products.length);
    }
  }, [products]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  const loadViewedHistory = useCallback(() => {
    getHistory().then((list) => setRecentProducts(list || []));
  }, []);

  useFocusEffect(useCallback(() => {
    loadViewedHistory();
  }, [loadViewedHistory]));

  const activeCategories = useMemo(() => {
    if (!categories || !Array.isArray(categories)) return [];
    
    // 1. Фильтруем пустые (только те, в которых есть товары)
    const filtered = categories.filter(cat => {
      return safeProducts.some(p => {
        const pCatId = (p as any).category_id || (p as any).categoryId || p.category;
        return String(pCatId) === String(cat.id) || 
               (typeof p.category === 'string' && cat.name && p.category.toLowerCase() === cat.name.toLowerCase());
      });
    });

    // 2. Сортировка: Находим индекс приоритетных категорий и выносим их вперед
    const getPriority = (name: string) => {
      const n = (name || '').toLowerCase().trim();
      if (n.includes('мікродоз') || n.includes('мікро') || n.includes('микро')) return 2;
      if (n.includes('гриби') || n.includes('грибы')) return 1;
      return 0;
    };

    return [...filtered].sort((a, b) => {
      const prioA = getPriority(a.name);
      const prioB = getPriority(b.name);
      
      if (prioA !== prioB) return prioB - prioA; // Сначала те, у кого приоритет выше
      return (a.name || '').localeCompare(b.name || ''); // Остальные по алфавиту
    });
  }, [categories, safeProducts]);

  const loadBanners = useCallback(async () => {
    try {
      const url = `${SERVER_URL}/banners`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bannerRes = await response.json();
      if (Array.isArray(bannerRes)) setBanners(bannerRes.slice(0, 5));
    } catch (e: any) {
      console.warn('Banner load error:', e);
      setBanners([]);
    }
  }, [API_URL]);

  useEffect(() => { 
    loadBanners(); 
  }, [loadBanners]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setToastVisible(false));
    }, 2000);
  };

  // Banner auto-scroll
  useEffect(() => {
    if (banners.length === 0) return;
    const { width } = Dimensions.get('window');
    const interval = setInterval(() => {
      setBannerIndex(prev => {
        const next = prev === banners.length - 1 ? 0 : prev + 1;
        bannerRef.current?.scrollTo({ x: next * (width - 40 + BANNER_GAP), animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [banners]);

  useEffect(() => {
    if (products && products.length > 0) {
      const searchName = 'мікродозінг стандарт'; 
      const targetProduct = products.find(p => p.name && p.name.toLowerCase().includes(searchName));
      if (targetProduct) {
        console.log('🎯 Found target product for badges');
      }
    }
  }, [products]);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Image source={require('../../assets/images/logo.png')} style={{ width: 110, height: 35 }} contentFit="contain" />
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => setIsSearchVisible(!isSearchVisible)} style={{ marginRight: 15 }}>
            <Ionicons name="search" size={24} color="black" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/favorites')} style={{ marginRight: 15 }}>
            <Ionicons name="heart" color="red" size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/cart')}>
            <Ionicons name="cart" size={26} color="black" />
            {cartItems.length > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItems.reduce((s, i) => s + (i.quantity || 1), 0)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* SEARCH BAR */}
      {isSearchVisible && (
        <View style={styles.searchBar}>
          <TextInput 
            placeholder="Пошук..." 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
            style={styles.searchInput} 
            autoFocus 
          />
          <TouchableOpacity onPress={() => { setIsSearchVisible(false); setSearchQuery(''); }}>
            <Ionicons name="close" size={24} color="black" />
          </TouchableOpacity>
        </View>
      )}

      {/* LOADING / EMPTY STATES */}
      {isLoading && safeProducts.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.statusText}>Завантаження товарів...</Text>
        </View>
      ) : !isLoading && safeProducts.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={60} color="#ccc" />
          <Text style={styles.statusText}>Товари завантажуються...</Text>
          <TouchableOpacity onPress={fetchProducts} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Оновити</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          ref={mainScrollRef} 
          style={styles.mainScroll} 
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.light.tint]} />}
        >
          {/* 0. Категории (Над баннером) */}
          <CategoriesSection categories={activeCategories} />

          {/* BANNERS (Hero section) */}
          {banners.length > 0 && (
            <ScrollView
              ref={bannerRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              style={{ marginBottom: 10, marginTop: 10 }}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              snapToInterval={Dimensions.get('window').width - 40 + BANNER_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              {banners?.map((b: any) => (
                <BannerImage 
                  key={b?.id || Math.random().toString()} 
                  uri={getImageUrl(b?.image_url || b?.image || b?.picture)} 
                  width={Dimensions.get('window').width - 40} 
                  height={180} 
                />
              ))}
            </ScrollView>
          )}

          {/* 1. История (теперь под баннером) */}
          {recentProducts && recentProducts.length > 0 && (
            <RecentlyViewed products={recentProducts} />
          )}

          {/* 2. Хиты (главный калибр) */}
          <ProductSection 
            title="Хіти продажів" 
            products={hitProducts} 
            onCartPress={(item, variant) => {
              const itm = variant ? { ...item, ...variant } : item;
              addItem(itm, 1, item.unit || 'шт');
              showToast('Додано в кошик');
            }} 
          />

          {/* 3. Акции (давим на выгоду) */}
          <ProductSection 
            title="Акції" 
            products={promoProducts} 
            onCartPress={(item, variant) => {
              const itm = variant ? { ...item, ...variant } : item;
              addItem(itm, 1, item.unit || 'шт');
              showToast('Додано в кошик');
            }} 
          />

          {/* 4. Новинки (свежак) */}
          <ProductSection 
            title="Новинки" 
            products={newProducts} 
            onCartPress={(item, variant) => {
              const itm = variant ? { ...item, ...variant } : item;
              addItem(itm, 1, item.unit || 'шт');
              showToast('Додано в кошик');
            }} 
          />

          {/* 5. Блог */}
          <BlogSection />
        </ScrollView>
      )}

      <Modal animationType="fade" transparent visible={successVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
            <Text style={styles.modalTitle}>Замовлення прийнято!</Text>
            <TouchableOpacity onPress={() => { setSuccessVisible(false); router.push('/profile'); }} style={styles.modalBtn}>
              <Text style={styles.modalBtnText}>Закрити</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FloatingChatButton bottomOffset={20} />
      
      {toastVisible && (
        <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  cartBadge: {
    position: 'absolute', right: -8, top: -5, backgroundColor: 'red', borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', 
    borderWidth: 1.5, borderColor: 'white'
  },
  cartBadgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  searchBar: { 
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, 
    borderBottomWidth: 1, borderBottomColor: '#eee' 
  },
  searchInput: { flex: 1, backgroundColor: '#f5f5f5', padding: 10, borderRadius: 10, marginRight: 10 },
  mainScroll: { flex: 1 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', paddingHorizontal: 20, marginBottom: 12, color: '#111' },
  productsListContent: { paddingHorizontal: 15 },
  productCardWrapper: { width: 160, marginRight: 12 },
  recentlyViewedThumb: { marginRight: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  recentlyViewedImage: { width: 80, height: 80 },
  blogCard: { width: 280, backgroundColor: '#fff', borderRadius: 16, marginRight: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#f0f0f0' },
  blogCardImage: { width: '100%', height: 160 },
  blogCardContent: { padding: 12 },
  blogCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#111', lineHeight: 20, marginBottom: 6 },
  blogCardDate: { fontSize: 12, color: '#999' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  statusText: { marginTop: 15, fontSize: 16, color: '#999', textAlign: 'center' },
  retryBtn: { marginTop: 20, backgroundColor: '#000', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12 },
  retryBtnText: { color: '#fff', fontWeight: 'bold' },
  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, zIndex: 999
  },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  bannerPlaceholder: { backgroundColor: '#f0f0f0', borderRadius: 12, marginRight: BANNER_GAP, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  successModal: { backgroundColor: '#fff', width: '80%', padding: 25, borderRadius: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 15 },
  modalBtn: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12, width: '100%' },
  modalBtnText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  categoryBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryBadgeText: { fontSize: 13, color: '#111', fontWeight: '700' },
});
