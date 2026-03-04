import { Colors } from '@/constants/theme';
import { getImageUrl, pickPrimaryProductImagePath } from '@/utils/image';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';


export interface ProductCardSmallItem {
  id: number;
  name: string;
  price: number;
  old_price?: number;
  /** Відсоток знижки з БД (поле discount або discount_percent) */
  discount?: number;
  discount_percent?: number;
  image?: string;
  images?: string;
  picture?: string;
  image_url?: string;
  minPrice?: number;
  variants?: any[];
}

interface ProductCardSmallProps {
  item: ProductCardSmallItem;
  onPress: () => void;
  onCartPress: () => void;
  cardWidth?: number | '100%';
}

export default function ProductCardSmall({ item, onPress, onCartPress, cardWidth = 160 }: ProductCardSmallProps) {
  const safeName = item.name || '';
  const safePrice = item.price ?? 0;
  const safeOldPrice = item.old_price ?? 0;
  const hasDiscount = safeOldPrice > 0 && safeOldPrice > safePrice;
  const discountPercent = item.discount_percent ?? item.discount ?? 0;
  const showDiscountBadge = discountPercent != null && Number(discountPercent) > 0;
  const pickedPath = pickPrimaryProductImagePath(item);
  const imageUrl = pickedPath ? getImageUrl(pickedPath, { width: 280, height: 280, quality: 85 }) : getImageUrl(null);

  const displayPrice =
    item.variants && Array.isArray(item.variants) && item.variants.length > 1 && item.minPrice != null
      ? item.minPrice
      : safePrice;

  const formatPrice = (p: number) =>
    `${p.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₴`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, { width: cardWidth }]}
    >
      <View style={styles.imageWrap}>
        {pickedPath ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="#ccc" />
          </View>
        )}
        {showDiscountBadge && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{Number(discountPercent)}%</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {safeName}
      </Text>
      <View style={styles.prices}>
        {hasDiscount && (
          <Text style={styles.oldPrice}>{formatPrice(safeOldPrice)}</Text>
        )}
        <Text style={styles.price}>{formatPrice(displayPrice)}</Text>
      </View>
      <TouchableOpacity
        onPress={(e) => {
          e?.stopPropagation?.();
          onCartPress();
        }}
        style={styles.cartButton}
        activeOpacity={0.8}
      >
        <Text style={styles.cartButtonText}>В кошик</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    paddingBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5',
    position: 'relative',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: '#FF4B4B',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    paddingHorizontal: 8,
    paddingTop: 8,
    lineHeight: 18,
    minHeight: 32,
    textAlign: 'center',
    width: '100%',
  },
  prices: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  oldPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    textAlign: 'center',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  cartButton: {
    width: '90%',
    marginTop: 8,
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
