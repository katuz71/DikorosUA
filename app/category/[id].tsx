import { Dimensions } from 'react-native';
import ProductCardSmall from '@/components/ProductCardSmall';
import { FloatingChatButton } from '@/components/FloatingChatButton';
import { parseImages } from '@/utils/image';
import { Image } from 'expo-image';
import { Colors, Fonts } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { logAddToCart } from '@/src/utils/analytics';
import { useFavoritesStore } from '@/store/favoritesStore';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CategoryScreen() {
  const router = useRouter();

  // 2. Получение и парсинг данных
  const params = useLocalSearchParams<{ id: string; name?: string; banners?: string; banner_url?: string }>();

  let rawBanners: string[] = [];
  try {
    rawBanners = params.banners ? JSON.parse(params.banners) : [];
  } catch (e) {
    rawBanners = [];
  }

  // Если массив пуст, но есть старый banner_url - добавляем его
  if (rawBanners.length === 0 && params.banner_url) {
    rawBanners = [params.banner_url];
  }

  // Преобразуем короткие пути (/uploads/...) в полные URL (https://dikoros.ua/uploads/...)
  const bannerList = parseImages(rawBanners);

  const categoryId = params.id;
  const categoryName = params.name ?? '';
  const { products, isLoading: productsLoading } = useOrders();
  const { addItem, items: cartItems } = useCart();
  const { toggleFavorite, isFavorite: isFavoriteById } = useFavoritesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const cartCount = (cartItems || []).reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);

  const productsInCategory = useMemo(() => {
    if (!categoryName) return [];
    const list = Array.isArray(products) ? products : [];
    let filtered = list.filter((p: any) => (p?.category || '').trim() === categoryName.trim());

    if (searchQuery.trim() !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((p: any) => (p?.name || '').toLowerCase().includes(lowerQuery));
    }
    return filtered;
  }, [products, categoryName, searchQuery]);

  const showToast = () => {}; // optional: pass toast from parent or use shared toast

  if (productsLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.loadingText}>Завантаження...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerSide, styles.headerSideLeft]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {categoryName || `Категорія ${categoryId}`}
        </Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={() => setIsSearchVisible(!isSearchVisible)}
            style={styles.headerIconBtn}
          >
            <Ionicons name="search" size={24} color="black" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/favorites')}
            style={styles.headerIconBtn}
          >
            <Ionicons name="heart" color="red" size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => router.push('/(tabs)/cart')}
          >
            <Ionicons name="cart" size={26} color="black" />
            {cartCount > 0 && (
              <View style={[styles.cartBadge, Platform.OS === 'ios' && { zIndex: 10 }]}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          </View>
        </View>
      </View>
      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Пошук..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity
            onPress={() => {
              setIsSearchVisible(false);
              setSearchQuery('');
            }}
            style={styles.searchCloseBtn}
          >
            <Ionicons name="close" size={24} color="black" />
          </TouchableOpacity>
        </View>
      )}
      {/* Баннер: один или слайдер */}
      {bannerList.length > 0 && (
        <View style={{ height: 200, width: '100%', marginBottom: 10, paddingHorizontal: 10, paddingTop: 10 }}>
          {bannerList.length === 1 ? (
            <Image
              source={{ uri: bannerList[0] }}
              style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: '#333' }}
              contentFit="cover"
            />
          ) : (
            <FlatList
              data={bannerList}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width: 380, height: 180, borderRadius: 12, marginRight: 10, backgroundColor: '#333' }}
                  contentFit="cover"
                />
              )}
            />
          )}
        </View>
      )}
      <FlatList
        data={productsInCategory}
        keyExtractor={(item) => String(item?.id ?? Math.random())}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ProductCardSmall
              item={item}
              onPress={() => item?.id && router.push(`/product/${item.id}`)}
              onCartPress={() => {
                Vibration.vibrate(10);
                addItem(item, 1, item.unit || 'шт');
                try {
                  logAddToCart(item);
                } catch (_) {}
              }}
              isFavorite={item?.id != null ? isFavoriteById(item.id) : false}
              onFavoritePress={() => {
                if (item?.id == null) return;
                Vibration.vibrate(10);
                toggleFavorite({
                  id: item.id,
                  name: item.name || '',
                  price: item.price ?? 0,
                  image: item.image || item.image_url || item.picture || '',
                  category: item.category,
                  old_price: item.old_price,
                  unit: item.unit,
                });
              }}
              cardWidth="100%"
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={56} color="#ccc" />
            <Text style={styles.emptyText}>У цій категорії поки немає товарів</Text>
          </View>
        }
      />
      {/* Floating Chat Button */}
      <FloatingChatButton bottomOffset={120} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 28,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    overflow: 'visible',
  },
  headerSide: {
    width: 130,
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  headerSideLeft: {
    width: 56,
    minWidth: 56,
  },
  headerSideRight: {
    justifyContent: 'flex-end',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  headerIconBtn: {
    marginLeft: 12,
    position: 'relative',
  },
  cartBadge: {
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
    borderWidth: 2,
    borderColor: 'white',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    paddingLeft: 8,
    paddingRight: 8,
  },
  bannerWrap: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
  },
  bannerWrapSingle: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    minHeight: 200,
  },
  bannerImg: {
    width: '100%',
    borderRadius: 12,
  },
  bannerSliderWrap: {
    marginTop: 12,
    marginBottom: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 40,
    fontSize: 16,
    color: '#111',
    marginRight: 10,
  },
  searchCloseBtn: {
    padding: 8,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 32,
  },
  cardWrapper: {
    width: (SCREEN_WIDTH - 24 - 10) / 2, // paddingHorizontal 12*2 + gap 10
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#888',
  },
});
