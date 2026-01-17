import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getImageUrl } from '../app/utils/image';
import ProductImage from './ProductImage';

// Helper function to get first image from item
const getFirstImage = (item: any) => {
  console.log(" getFirstImage called with:", {
    images: item.images,
    image: item.image,
    picture: item.picture,
    image_url: item.image_url
  });
  
  let imagePath = '';
  
  if (item.images) {
    // If multiple images exist, take the first one
    const urls = item.images.split(',').map((url: string) => url.trim()).filter((url: string) => url);
    imagePath = urls[0] || item.picture || item.image || item.image_url || '';
    console.log("🔍 Using images field, first image:", imagePath);
  } else {
    imagePath = item.picture || item.image || item.image_url || '';
    console.log("🔍 Using fallback image:", imagePath);
  }
  
  // Apply getImageUrl to convert relative paths to full URLs
  const fullUrl = getImageUrl(imagePath);
  console.log("🔍 Final image URL:", fullUrl);
  return fullUrl;
};

const { width: screenWidth } = Dimensions.get('window');
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
    category?: string;
    unit?: string;
  };
  onPress: () => void;
  onFavoritePress: () => void;
  onCartPress: () => void;
  isFavorite: boolean;
}

export default function ProductCard({ 
  item, 
  onPress, 
  onFavoritePress, 
  onCartPress, 
  isFavorite 
}: ProductCardProps) {
  const safeName = item.name || '';
  const safePrice = item.price || 0;
  const safeOldPrice = item.old_price || 0;
  const hasDiscount = safeOldPrice > 0 && safeOldPrice > safePrice;
  const safeBadge = item.badge || '';
  const hasImage = getFirstImage(item) !== '';

  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.card}
    >
      {/* Блок изображения (Верх) */}
      <View style={styles.imageBlock}>
        {hasImage ? (
          <ProductImage 
            uri={getFirstImage(item)} 
            style={styles.image}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="#ccc" />
          </View>
        )}
        
        {/* Бейдж */}
        {safeBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{safeBadge}</Text>
          </View>
        )}
        
        {/* Кнопка избранного */}
        <TouchableOpacity 
          onPress={onFavoritePress}
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
              {safePrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴
            </Text>
            {hasDiscount && (
              <Text style={styles.oldPrice}>
                {safeOldPrice} ₴
              </Text>
            )}
          </View>
          
          {/* Кнопка корзины */}
          <TouchableOpacity 
            onPress={onCartPress}
            style={styles.cartButton}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="cart-outline" 
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
    minHeight: 300, // Фиксированная минимальная высота
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
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
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
    backgroundColor: '#111827',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
