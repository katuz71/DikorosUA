import { Dimensions } from 'react-native';
import ProductCardSmall from '@/components/ProductCardSmall';
import { Image } from 'expo-image';
import { Colors } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { logAddToCart } from '@/src/utils/analytics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 1. Константа адреса сервера
const API_BASE = 'http://80.209.231.210:8000';

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

  // 3. Создаем полные ссылки
  const bannerList = rawBanners.map((path) =>
    path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : '/' + path}`
  );

  const categoryId = params.id;
  const categoryName = params.name ?? '';
  const { products, isLoading: productsLoading } = useOrders();
  const { addItem } = useCart();
  const [searchQuery, setSearchQuery] = useState('');

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{categoryName || `Категорія ${categoryId}`}</Text>
        <View style={styles.backBtn} />
      </View>
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
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Фільтр за назвою (напр. Мухомор)"
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
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
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 15,
    color: '#111',
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
