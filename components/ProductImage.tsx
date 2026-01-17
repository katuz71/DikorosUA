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

  console.log('🖼️ ProductImage rendered with uri:', uri);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
      
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="image-outline" size={32} color="#ccc" />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={[styles.image, style]}
          onLoadStart={() => {
            console.log('🖼️ Image load start:', uri);
            setLoading(true);
          }}
          onLoadEnd={() => {
            console.log('🖼️ Image load end:', uri);
            setLoading(false);
          }}
          onError={(error) => {
            console.error('🖼️ Image load error:', { uri, error });
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
