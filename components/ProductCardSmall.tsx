import { Colors } from '@/constants/theme';
import { getImageUrl, pickPrimaryProductImagePath } from '@/utils/image';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ProductBadges } from './ProductBadges';

export interface ProductCardSmallItem {
  id: number;
  name: string;
  price: number;
  old_price?: number;
  /** Відсоток знижки з БД (поле discount или discount_percent) */
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
  is_hit?: boolean;
  status?: string;
}

interface ProductCardSmallProps {
  item: ProductCardSmallItem;
  onPress: () => void;
  onCartPress: (variant?: any) => void;
  cardWidth?: number | '100%';
  /** Переопределить высоту карточки (например, 300 для главной страницы) */
  cardHeight?: number;
  /** Показывать кнопку «в избранное» и вызывать onFavoritePress при нажатии */
  isFavorite?: boolean;
  onFavoritePress?: () => void;
}

export default function ProductCardSmall({ item, onPress, onCartPress, cardWidth = 160, cardHeight, isFavorite, onFavoritePress }: ProductCardSmallProps) {
  const hasVariants = Boolean(item.variants && item.variants.length > 1);
  const defaultVariant = item.variants && item.variants.length > 0 ? item.variants[0] : item;

  let safeName = item.name;
  if (!safeName || safeName.trim() === 'Без назви' || safeName.trim() === '') {
    safeName = (item.variants && item.variants.length > 0 && item.variants[0].name) 
      ? item.variants[0].name 
      : 'Товар';
  }
  const safePrice = item.price ?? 0;
  const safeOldPrice = item.old_price ?? 0;
  const hasDiscount = safeOldPrice > 0 && safeOldPrice > safePrice;
  const discountPercent = item.discount_percent ?? item.discount ?? (hasDiscount ? Math.round(((safeOldPrice - safePrice) / safeOldPrice) * 100) : 0);
  const showDiscountBadge = discountPercent != null && Number(discountPercent) > 0;
  const pickedPath = pickPrimaryProductImagePath(item);
  const imageUrl = pickedPath ? getImageUrl(pickedPath, { width: 280, height: 280, quality: 85 }) : getImageUrl(null);

  const formatPrice = (p: number) =>
    `${p.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₴`;

  const formattedPrice = formatPrice(safePrice);
  const displayPriceText = hasVariants ? `від ${formattedPrice}` : formattedPrice;

  const isHit = item.is_hit || item.is_bestseller || (item.variants && item.variants.length > 0 && item.variants[0].is_hit);
  const isNew = item.is_new || (item.variants && item.variants.length > 0 && item.variants[0].is_new);
  const isPromotion = item.is_promotion || (item.variants && item.variants.length > 0 && item.variants[0].is_promotion);
  
  // Checking availability from status
  const itemStatus = item.status || (item.variants && item.variants.length > 0 ? item.variants[0].status : undefined);
  const isAvailable = itemStatus === 'available' || itemStatus === 'in_stock';

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
            <ProductBadges product={item} />
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
            <Text style={styles.price}>{displayPriceText}</Text>
          </View>

          <TouchableOpacity
            onPress={(e) => {
              e?.stopPropagation?.();
              if (hasVariants) {
                onPress();
              } else {
                onCartPress(defaultVariant);
              }
            }}
            style={[styles.cartButton, !isAvailable && { backgroundColor: '#ccc' }]}
            activeOpacity={0.8}
            disabled={!isAvailable}
          >
            <Ionicons 
              name="cart-outline" 
              size={18} 
              color="white" 
            />
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
    marginTop: 10,
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cartButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
