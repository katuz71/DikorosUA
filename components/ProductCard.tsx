import { getImageUrl, isLikelyCertificateImage } from '@/utils/image';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProductImage from './ProductImage';

const getImageCandidates = (item: any): string[] => {
  const out: string[] = [];
  const push = (u: any) => {
    const s = typeof u === 'string' ? u.trim() : String(u ?? '').trim();
    if (!s || s === 'null' || s === 'undefined') return;
    out.push(getImageUrl(s));
  };

  const imagesValue = item?.images;
  if (Array.isArray(imagesValue)) {
    imagesValue.forEach(push);
  } else if (typeof imagesValue === 'string') {
    const t = imagesValue.trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) parsed.forEach(push);
      } catch {}
    } else {
      t.split(',').map((x: string) => x.trim()).forEach(push);
    }
  }

  // main first
  const main = (item?.image || item?.picture || item?.image_url || '').trim();
  if (main) out.unshift(getImageUrl(main));

  // Dedupe
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const u of out) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    deduped.push(u);
  }
  return deduped.slice(0, 12);
};

// Helper function to get first image from item
const getFirstImage = (item: any) => {
  console.log(" getFirstImage called with:", {
    images: item.images,
    image: item.image,
    picture: item.picture,
    image_url: item.image_url
  });
  
  let imagePath = '';
  
  // Try to get images field (string JSON/CSV or array)
  const imagesValue = item?.images;
  if (Array.isArray(imagesValue) && imagesValue.length > 0) {
    imagePath =
      imagesValue.find((url: any) => typeof url === 'string' && url.trim() && !isLikelyCertificateImage(url)) ||
      imagesValue.find((url: any) => typeof url === 'string' && url.trim()) ||
      '';
    console.log("🔍 Using images array, first image:", imagePath);
  } else if (imagesValue && typeof imagesValue === 'string') {
    const trimmedImages = imagesValue.trim();
    
    // Skip if it's empty or "null" string
    if (trimmedImages && trimmedImages !== 'null' && trimmedImages !== 'undefined') {
      // Handle JSON arrays in string format like ["url1", "url2"]
      if (trimmedImages.startsWith('[') && trimmedImages.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmedImages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Take first non-empty, non-certificate image from array
            imagePath =
              parsed.find((url: string) => url && url.trim() && !isLikelyCertificateImage(url)) ||
              parsed.find((url: string) => url && url.trim()) ||
              '';
          }
        } catch (e) {
          console.error('Failed to parse images array:', imagesValue);
        }
      } else {
        // If multiple images exist as comma-separated, take the first non-empty one
        const urls = trimmedImages
          .split(',')
          .map((url: string) => url.trim())
          .filter((url: string) => url && url !== 'null' && url !== 'undefined');
        imagePath = urls.find((u: string) => !isLikelyCertificateImage(u)) || urls[0] || '';
      }
      
      console.log("🔍 Using images field, first image:", imagePath);
    }
  }
  
  // Fallback to other fields if images didn't provide a valid path
  if (!imagePath) {
    imagePath = (item.image || item.picture || item.image_url || '').trim();
    console.log("🔍 Using fallback image:", imagePath);
  }

  // If fallback is a certificate image, we still return it (no other option)
  
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
  displayPrice?: string; // New optional prop for "from X"
  onPress: () => void;
  onFavoritePress: () => void;
  onCartPress: () => void;
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
  const safePrice = item.price || 0;
  const safeOldPrice = item.old_price || 0;
  const hasDiscount = safeOldPrice > 0 && safeOldPrice > safePrice;
  const safeBadge = item.badge || '';
  const rawCandidate =
    (typeof item.images === 'string' ? item.images : Array.isArray(item.images) ? (item.images[0] ?? '') : '') ||
    item.picture ||
    item.image ||
    item.image_url ||
    '';
  const rawImagePath = typeof rawCandidate === 'string' ? rawCandidate.trim() : '';
  const hasImage = rawImagePath !== '' && rawImagePath !== 'null' && rawImagePath !== 'undefined';
  console.log(`[ProductCard] id=${item.id} hasImage=${hasImage} raw=${rawImagePath}`);

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
            uri={getFirstImage(item)} 
            uris={getImageCandidates(item)}
            cacheKey={item.id}
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
              {displayPrice || `${safePrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`}
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
              onCartPress();
            }}
            onPressIn={(e) => {
              e?.stopPropagation?.();
            }}
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
    backgroundColor: '#2E7D32',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
