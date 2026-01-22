import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

interface ProductImageProps {
  uri: string;
  style?: any;
  size?: number;
}

export default function ProductImage({ uri, style, size = 200 }: ProductImageProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  // Validate URI
  const isValidUri = uri && typeof uri === 'string' && uri.trim() !== '';
  const imageUri = isValidUri ? uri.trim() : null;

  console.log('🖼️ ProductImage rendered with uri:', imageUri);

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
      
      {error || !imageUri ? (
        <View style={styles.errorContainer}>
          <Ionicons name="image-outline" size={32} color="#ccc" />
        </View>
      ) : (
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, style]}
          onLoadStart={() => {
            console.log('🖼️ Image load start:', imageUri);
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => {
            console.log('🖼️ Image load end:', imageUri);
            setLoading(false);
          }}
          onError={(error) => {
            console.error('🖼️ Image load error:', imageUri, error?.nativeEvent?.error || 'Unknown error');
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
