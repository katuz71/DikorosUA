import { Dimensions } from 'react-native';
import ProductCardSmall from '@/components/ProductCardSmall';
import { Colors } from '@/constants/theme';
import { useCart } from '@/context/CartContext';
import { useOrders } from '@/context/OrdersContext';
import { logAddToCart } from '@/src/utils/analytics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const categoryId = params.id;
  const categoryName = params.name ?? '';
  const { products, isLoading: productsLoading } = useOrders();
  const { addItem } = useCart();

  const productsInCategory = useMemo(() => {
    if (!categoryName) return [];
    const list = Array.isArray(products) ? products : [];
    return list.filter((p: any) => (p?.category || '').trim() === categoryName.trim());
  }, [products, categoryName]);

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
      <FlatList
        data={productsInCategory}
        keyExtractor={(item) => String(item?.id ?? Math.random())}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <View style={{ width: (SCREEN_WIDTH / 2) - 15, margin: 5 }}>
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
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
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
