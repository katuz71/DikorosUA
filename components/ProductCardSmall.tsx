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
  images?: string | any[];
  picture?: string;
  image_url?: string;
  thumbnail?: string;
  imageUrl?: string;
  minPrice?: number;
  variants?: any[];
  is_bestseller?: boolean;
  is_new?: boolean;
  is_promotion?: boolean;
}

interface ProductCardSmallProps {
  item: ProductCardSmallItem;
  onPress: () => void;
  onCartPress: () => void;
  cardWidth?: number | '100%';
  /** Перевизначити висоту картки (наприклад, 300 для головної сторінки) */
  cardHeight?: number;
  /** Показувати кнопку «в обране» і викликати onFavoritePress при натисканні */
  isFavorite?: boolean;
  onFavoritePress?: () => void;
}

export default function ProductCardSmall({ item, onPress, onCartPress, cardWidth = 160, cardHeight, isFavorite, onFavoritePress }: ProductCardSmallProps) {
  const safeName = item.name || '';
  const safePrice = item.price ?? 0;
  const safeOldPrice = item.old_price ?? 0;
  const hasDiscount = safeOldPrice > 0 && safeOldPrice > safePrice;
  const discountPercent = item.discount_percent ?? item.discount ?? 0;
  const showDiscountBadge = discountPercent != null && Number(discountPercent) > 0;
  const sectionBadge =
    (item as ProductCardSmallItem).is_bestseller
      ? 'Хит'
      : (item as ProductCardSmallItem).is_new
        ? 'Новинка'
        : (item as ProductCardSmallItem).is_promotion
          ? 'Акция'
          : null;
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
      style={[styles.card, { width: cardWidth }, cardHeight != null && { height: cardHeight }]}
    >
      <View style={styles.cardInner}>
        <View>
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
            {onFavoritePress != null && (
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onFavoritePress();
                }}
                style={styles.favoriteButton}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isFavorite ? '#e74c3c' : '#333'}
                />
              </TouchableOpacity>
            )}
            {showDiscountBadge && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-{Number(discountPercent)}%</Text>
              </View>
            )}
            {sectionBadge && !showDiscountBadge && (
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{sectionBadge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {safeName}
          </Text>
        </View>
        <View style={styles.bottomBlock}>
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
        </View>
      </View>
    </TouchableOpacity>
  );
}

const CARD_HEIGHT = 320;

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'stretch',
    paddingBottom: 16,
  },
  cardInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bottomBlock: {
    paddingHorizontal: 10,
    paddingTop: 4,
    alignItems: 'center',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    minHeight: 140,
    backgroundColor: '#f5f5f5',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  favoriteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  image: {
    width: '100%',
    height: '100%',
    aspectRatio: 1,
    alignSelf: 'stretch',
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
