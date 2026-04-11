import { Colors } from '@/constants/theme';
import { getImageUrl, pickPrimaryProductImagePath } from '@/utils/image';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProductImage from './ProductImage';

// Используем flex вместо фиксированной ширины для идеальной симметрии

interface ProductCardProps {
  item: {
    id: number;
    name: string;
    price: number;
    old_price?: number;
    image?: string;
    images?: string;
    picture?: string;
    image_url?: string;
    badge?: string;
    is_new?: boolean;
    is_hit?: boolean;
    is_promotion?: boolean;
    category?: string;
    unit?: string;
    variants?: any[];
  };
  displayPrice?: string; // New optional prop for "from X"
  onPress: () => void;
  onFavoritePress: () => void;
  onCartPress: (variant?: any) => void;
  isFavorite: boolean;
  style?: any;
}

export default function ProductCard({ 
  item, 
  displayPrice, // destructure
  onPress, 
  onFavoritePress, 
  onCartPress, 
  isFavorite,
  style
}: ProductCardProps) {
  const safeName = item.name || '';
  const hasVariants = Boolean(item.variants && item.variants.length > 1);
  const defaultVariant = item.variants && item.variants.length > 0 ? item.variants[0] : item;
  
  const safePrice = item.price ?? 0;
  const safeOldPrice = item.old_price ?? 0;
  const hasDiscount = safeOldPrice > 0 && safeOldPrice > safePrice;
  const discountPercent = hasDiscount ? Math.round(((safeOldPrice - safePrice) / safeOldPrice) * 100) : 0;
  const safeBadge = item.badge || '';
  const pickedPath = pickPrimaryProductImagePath(item);
  const hasImage = pickedPath !== '';
  const pickedUrl = hasImage ? getImageUrl(pickedPath) : '';

  const formattedPrice = `${safePrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  const finalDisplayPrice = displayPrice || (hasVariants ? `від ${formattedPrice}` : formattedPrice);

  const isHit = item.is_hit || (item.variants && item.variants.length > 0 && item.variants[0].is_hit);
  const isNew = item.is_new || (item.variants && item.variants.length > 0 && item.variants[0].is_new);
  const isPromotion = item.is_promotion || (item.variants && item.variants.length > 0 && item.variants[0].is_promotion);
  
  // Checking availability from status
  const itemStatus = item.status || (item.variants && item.variants.length > 0 ? item.variants[0].status : undefined);
  const isAvailable = itemStatus === 'available' || itemStatus === 'in_stock';


  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, style]}
    >
      {/* Блок изображения (Верх) */}
      <View style={styles.imageBlock}>
        {hasImage ? (
          <ProductImage 
            uri={pickedUrl} 
            style={styles.image}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="#ccc" />
          </View>
        )}
        
        {/* Стикеры */}
        <View style={styles.stickersContainer}>
          {isNew && (
            <View style={[styles.sticker, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.stickerText}>НОВИНКА</Text>
            </View>
          )}
          {isHit && (
            <View style={[styles.sticker, { backgroundColor: '#10b981' }]}>
              <Text style={styles.stickerText}>ХІТ</Text>
            </View>
          )}
          {isPromotion && (
            <View style={[styles.sticker, { backgroundColor: '#f97316' }]}>
              <Text style={styles.stickerText}>АКЦІЯ</Text>
            </View>
          )}
          {hasDiscount && discountPercent > 0 && (
            <View style={[styles.sticker, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.stickerText}>-{discountPercent}%</Text>
            </View>
          )}
          {safeBadge ? (
            <View style={[styles.sticker, { backgroundColor: Colors.light.tint }]}>
              <Text style={styles.stickerText}>{safeBadge}</Text>
            </View>
          ) : null}
        </View>
        
        {/* Кнопка избранного */}
        <TouchableOpacity 
          onPress={(e) => {
            onFavoritePress();
          }}
          onPressIn={(e) => {
            e?.stopPropagation?.();
          }}
          style={styles.favoriteButton}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isFavorite ? "heart" : "heart-outline"} 
            size={18} 
            color={isFavorite ? "#DC2626" : "white"} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Инфо-блок (Центр) */}
      <View style={styles.infoBlock}>
        {/* Название товара */}
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={2}>
            {safeName}
          </Text>
        </View>
        
        {/* Нижний ряд (Цена + Корзина) - прижат к низу */}
        <View style={styles.bottomRow}>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>
              {finalDisplayPrice}
            </Text>
            {hasDiscount && (
              <Text style={styles.oldPrice}>
                {safeOldPrice} ₴
              </Text>
            )}
          </View>

          {/* Кнопка корзины */}
          <TouchableOpacity 
            onPress={(e) => {
              e?.stopPropagation?.();
              if (hasVariants) {
                onPress(); // Open detail screen if there are variants
              } else {
                onCartPress(defaultVariant);
              }
            }}
            style={[styles.cartButton, !isAvailable && { backgroundColor: '#ccc' }]}
            activeOpacity={0.7}
            disabled={!isAvailable}
          >
            <Ionicons 
              name={hasVariants ? "list-outline" : "cart-outline"} 
              size={16} 
              color="white" 
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 0.48, // 48% ширины контейнера для идеального распределения
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    minHeight: 260, // Уменьшили высоту, так как вариантов больше нет
    flexDirection: 'column',
  },
  imageBlock: {
    position: 'relative',
    aspectRatio: 1, // Квадратный блок изображения
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  stickersContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
    gap: 4,
    zIndex: 10,
    alignItems: 'flex-start',
  },
  sticker: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  stickerText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBlock: {
    flex: 1,
    flexDirection: 'column',
    padding: 12,
    justifyContent: 'space-between', // Распределяем пространство
  },
  nameContainer: {
    minHeight: 40, // Фиксированная высота на 2 строки
    maxHeight: 40,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 20,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto', // Прижимаем к низу
  },
  priceContainer: {
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  oldPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  cartButton: {
    backgroundColor: Colors.light.tint,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
