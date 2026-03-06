import { API_URL } from '@/config/api';
import { getImageUrl } from '@/utils/image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const options = { title: 'Дико-Корисно' };

type Post = {
  id: number;
  title: string;
  body?: string;
  content?: string;
  image_url?: string;
  created_at?: string;
  published_at?: string;
};

export default function BlogPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('Статья не найдена 🍄');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Сначала пробуем получить одну статью по id
      const res = await fetch(`${API_URL}/posts/${id}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setPost(data);
        return;
      }
      // Если нет эндпоинта /posts/:id — грузим список и ищем по id
      const listRes = await fetch(`${API_URL}/posts`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!listRes.ok) throw new Error('Не вдалося завантажити статтю');
      const list = await listRes.json();
      const found = Array.isArray(list) ? list.find((p: any) => String(p.id) === String(id)) : null;
      setPost(found || null);
      if (!found) setError('Статья не найдена 🍄');
    } catch (e) {
      setError((e as Error).message || 'Помилка завантаження');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const bodyText = post?.body ?? post?.content ?? '';
  const dateStr = post?.created_at || post?.published_at
    ? new Date(post.created_at || post.published_at!).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color="#333" />
        <Text style={styles.loadingText}>Завантаження...</Text>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 8 : 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Стаття</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={48} color="#ccc" />
          <Text style={styles.errorText}>{error || 'Статья не найдена 🍄'}</Text>
        </View>
      </View>
    );
  }

  const coverUri = post.image_url ? getImageUrl(post.image_url, { width: Math.round(SCREEN_WIDTH * 2), height: 400, quality: 85 }) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Стаття</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="image-outline" size={64} color="#ccc" />
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{post.title}</Text>
          {dateStr ? <Text style={styles.date}>{dateStr}</Text> : null}
          <Markdown
            style={markdownStyles}
            mergeStyle={false}
            onLinkPress={(url) => {
              if (url.startsWith('dikorosua://product/')) {
                const parts = url.split('/');
                const productId = parts[parts.length - 1];
                router.push(`/product/${productId}`);
                return false; // не открывать ссылку как внешнюю
              }
              return true; // http-ссылки открывать как обычно
            }}
          >
            {bodyText.split('\\n').join('\n')}
          </Markdown>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  cover: {
    width: SCREEN_WIDTH,
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    lineHeight: 32,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  body: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

const markdownStyles = {
  body: styles.body,
  text: styles.body,
  paragraph: styles.body,
  strong: { ...styles.body, fontWeight: 'bold' as const },
  link: {
    color: '#2563EB',
    textDecorationLine: 'underline' as const,
    fontWeight: 'bold' as const,
  },
};
