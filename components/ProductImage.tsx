import { API_URL } from '@/config/api';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300';

interface ProductImageProps {
  uri: string;
  style?: any;
  size?: number;
}

export default function ProductImage({ uri, style, size = 200 }: ProductImageProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  // Локальные картинки: относительный путь объединяем с API_URL; http оставляем как есть
  const rawUri = uri && typeof uri === 'string' ? uri.trim() : '';
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const imageUrl = rawUri
    ? (rawUri.startsWith('http') ? rawUri : `${baseUrl}${rawUri.startsWith('/') ? rawUri : '/' + rawUri}`)
    : PLACEHOLDER_IMAGE;
  const isValidUri = rawUri !== '';

  // If no valid URI, show error state immediately
  React.useEffect(() => {
    if (!isValidUri) {
      setLoading(false);
      setError(true);
    }
  }, [isValidUri]);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {loading && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
      
      {error || !isValidUri ? (
        <View style={styles.errorContainer}>
          <Ionicons name="image-outline" size={32} color="#ccc" />
        </View>
      ) : (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, style]}
          contentFit="cover"
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => {
            setLoading(false);
          }}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
