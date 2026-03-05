import { Colors } from '@/constants/theme';
import { useCategories } from '@/context/CategoriesContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GRID_COLUMNS = 2;
const HORIZONTAL_PADDING = 10;
const CARD_MIN_HEIGHT = 140;

const getCategoryIcon = (name: string) => {
  if (!name) return 'leaf';
  const lowerName = name.toLowerCase();
  if (lowerName.includes('cbd')) return 'cannabis';
  if (lowerName.includes('ваги')) return 'scale-balance';
  if (lowerName.includes('трав') || lowerName.includes('ягод')) return 'sprout-outline';
  if (lowerName.includes('настоян')) return 'bottle-tonic-outline';
  if (lowerName.includes('мазі') || lowerName.includes('мазь')) return 'lotion-outline';
  if (lowerName.includes('мед')) return 'beehive-outline';
  if (lowerName.includes('варення')) return 'pot-outline';
  if (lowerName.includes('гриби') || lowerName.includes('мухомор')) return 'mushroom-outline';
  if (lowerName.includes('мікродоз') || lowerName.includes('капсул')) return 'pill';
  return 'leaf';
};

export default function CatalogScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - HORIZONTAL_PADDING * 2) / GRID_COLUMNS;
  const router = useRouter();
  const { categories, isLoading } = useCategories();

  const onCategoryPress = (id: number, name: string, banner_url?: string, banners?: string[]) => {
    console.log('SENDING BANNERS:', banners);
    router.push({
      pathname: '/category/[id]',
      params: { id: String(id), name, banner_url: banner_url || '', banners: JSON.stringify(banners || []) },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Каталог</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loadingText}>Завантаження категорій...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Каталог</Text>
        <Text style={styles.subtitle}>Оберіть категорію</Text>
      </View>
      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        numColumns={GRID_COLUMNS}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { width: cardWidth, minHeight: CARD_MIN_HEIGHT }]}
            onPress={() => onCategoryPress(item.id, item.name, item.banner_url, item.banners)}
            activeOpacity={0.85}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={getCategoryIcon(item.name)}
                size={44}
                color={Colors.light.tint}
              />
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#999" style={styles.chevron} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Категорій поки немає</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 32,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#eee',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.tint + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
  },
  chevron: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
});