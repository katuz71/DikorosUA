import { FloatingChatButton } from '@/components/FloatingChatButton';
import { API_URL } from '@/config/api';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { trackPurchase, trackSignUp } from '@/utils/analytics';
import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import { getPushTokenAsync } from '@/utils/pushNotifications';

const PURCHASE_TRACKED_ORDER_IDS_KEY = 'analytics_purchase_tracked_order_ids';

WebBrowser.maybeCompleteAuthSession();

// OAuth: Android — Code flow, Expo сам обміняє code на idToken і покладе в authentication
const GOOGLE_ANDROID_CLIENT_ID = '451079322222-49sf5d8pc3kb2fr10022b5im58s21ao6.apps.googleusercontent.com';

const STORAGE_JWT_KEY = 'userToken';

// --- ТИПЫ ---
interface UserProfile {
  phone: string;
  bonus_balance: number;
  total_spent: number;
  cashback_percent: number;
  name?: string;
  city?: string;
  warehouse?: string;
  ukrposhta?: string;
  email?: string;
  contact_preference?: 'call' | 'telegram' | 'viber';
}

interface Order {
  id: number;
  totalPrice: number;
  status: string;
  date: string;
  items: any[];
}

import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { clearAllAuth } = useAuth();
  // Состояния
  const [phone, setPhone] = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  // Info Modal States
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoName, setInfoName] = useState('');
  const [infoCity, setInfoCity] = useState('');
  const [infoWarehouse, setInfoWarehouse] = useState(''); // 🔥 Модалка для таблицы
  const [infoUkrposhta, setInfoUkrposhta] = useState('');
  const [localCity, setLocalCity] = useState('');
  const [localWarehouse, setLocalWarehouse] = useState('');
  const [infoEmail, setInfoEmail] = useState('');
  const [infoContactPreference, setInfoContactPreference] = useState<'call' | 'telegram' | 'viber'>('call');
  const [infoPhone, setInfoPhone] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Reviews State
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | null>(null);

  /** После успешного входа — получаем push-токен и сохраняем. sendWelcome: true только при sign_up (приветственный пуш один раз). */
  const savePushTokenForUser = useCallback(async (authId: string, sendWelcome = false) => {
    try {
      const token = await getPushTokenAsync();
      if (!token?.trim()) return;
      await fetch(`${API_URL}/api/user/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_id: authId, token, send_welcome: sendWelcome }),
      });
    } catch {
      // Игнорируем, чтобы не блокировать вход
    }
  }, []);

  const parseFragmentParams = (url: string): Record<string, string> => {
    const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
    return Object.fromEntries(new URLSearchParams(hash));
  };

  // Code flow: нативний Android — Expo проведе обмін і покладе idToken в authentication
  const googleRedirectUri = AuthSession.makeRedirectUri({ scheme: 'com.dikorosua.app' });
  const [googleRequest, googleResponse, promptGoogleAsync] = useAuthRequest({
    clientId: GOOGLE_ANDROID_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: googleRedirectUri,
    shouldAutoExchangeCode: true,
  });

  useEffect(() => {
    if (__DEV__ && googleRedirectUri) {
      console.log('[Google OAuth] Додай цей Redirect URI в Google Cloud Console → APIs & Services → Credentials → твій OAuth client → Authorized redirect URIs:', googleRedirectUri);
    }
  }, [googleRedirectUri]);

  const signInWithGoogle = async () => {
    if (!googleRequest) return;
    setSocialLoading('google');
    try {
      const result = await promptGoogleAsync();
      if (result?.type !== 'success') {
        setSocialLoading(null);
        return;
      }
      // Відправку на бекенд робить лише useEffect нижче по googleResponse
    } catch (e: any) {
      setSocialLoading(null);
      const msg = e?.message ?? 'Не вдалося увійти через Google';
      const isRedirectError = /redirect|invalid.*grant|client/i.test(String(msg));
      Alert.alert(
        'Помилка входу через Google',
        isRedirectError
          ? 'Перевірте Redirect URI в Google Cloud Console (Credentials → OAuth client → Authorized redirect URIs). У логах консолі має бути точний URI.'
          : msg
      );
    }
  };

  // Обробка помилки OAuth (наприклад, redirect URI не збігається з налаштуваннями в Google Console)
  useEffect(() => {
    const res = googleResponse as { type: string; error?: { message?: string }; params?: { error?: string } } | null;
    if (res?.type === 'error' && socialLoading === 'google') {
      setSocialLoading(null);
      const msg = res?.error?.message || res?.params?.error || 'Помилка авторизації Google';
      const isRedirectError = /redirect|invalid.*grant|client/i.test(String(msg));
      Alert.alert(
        'Помилка входу через Google',
        isRedirectError
          ? 'Перевірте, що в Google Cloud Console у клієнта OAuth додано точно такий Authorized redirect URI, як показується в логах (консоль розробника).'
          : msg
      );
    }
  }, [googleResponse, socialLoading]);

  useEffect(() => {
    if (googleResponse?.type === 'success' && socialLoading === 'google') {
      const idToken = (googleResponse as any).authentication?.idToken;
      if (idToken) {
        sendSocialTokenAndLogin('google', idToken).catch((e: any) => {
          setSocialLoading(null);
          Alert.alert('Помилка', e?.message ?? 'Не вдалося увійти через Google');
        });
      } else {
        setSocialLoading(null);
        Alert.alert('Помилка', 'Не отримано idToken від Google (authentication.idToken).');
      }
    }
  }, [googleResponse?.type, socialLoading]);

  const sendSocialTokenAndLogin = async (
    provider: 'google',
    token: string
  ) => {
    try {
      const body: Record<string, string> = { token, provider };
      const res = await fetch(`${API_URL}/api/auth/social-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Помилка авторизації');
      }
      const data = await res.json();
      const { access_token: jwt, needs_phone, auth_id, ...user } = data;
      const userPhone = user.phone ?? auth_id ?? null;

      if (needs_phone && auth_id) {
        // Сохраняем пользователя до отправки sign_up, чтобы в аналитику ушёл auth_id
        await SecureStore.setItemAsync(STORAGE_JWT_KEY, jwt || '');
        await AsyncStorage.setItem(STORAGE_JWT_KEY, jwt || '');
        await AsyncStorage.setItem('userPhone', auth_id);
        setPhone(auth_id);
        setProfile({
          ...user,
          phone: undefined,
          bonus_balance: user.bonus_balance ?? 0,
        });
        setShowLoginModal(false);
        setSocialLoading(null);
        savePushTokenForUser(auth_id, true); // приветственный пуш только после sign_up
        trackSignUp('Google'); // Сразу после первого входа через Google
        return;
      }

      await AsyncStorage.setItem('userPhone', userPhone);
      if (jwt) {
        await SecureStore.setItemAsync(STORAGE_JWT_KEY, jwt);
        await AsyncStorage.setItem(STORAGE_JWT_KEY, jwt);
      }
      if (user.name) await AsyncStorage.setItem('userName', user.name);
      setPhone(userPhone);
      setProfile({ ...user, bonus_balance: user.bonus_balance ?? 0 });
      setShowLoginModal(false);
      setSocialLoading(null);
      savePushTokenForUser(userPhone ?? auth_id ?? '', false); // логін, не sign_up — без привітального пуша
      fetchData(userPhone);
    } catch (e: any) {
      setSocialLoading(null);
      Alert.alert('Помилка', e?.message || 'Не вдалося увійти');
    }
  };

  // 1. Проверка авторизации и обновление данных при фокусе
  useFocusEffect(
    useCallback(() => {
      checkLogin();
    }, [])
  );

  // Синхронизация пуш-токена при появлении phone (напр. после чекаута редирект на профіль). Без send_welcome — привітальний пуш тільки при sign_up.
  useEffect(() => {
    if (!phone) return;
    let cancelled = false;
    (async () => {
      const token = await getPushTokenAsync();
      if (cancelled || !token) return;
      try {
        await fetch(`${API_URL}/api/user/push-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth_id: phone, token, send_welcome: false }),
        });
      } catch (e) {
        console.warn('[Push] Не вдалося відправити токен на бекенд:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [phone]);

  const checkLogin = async () => {
    const storedPhone = await AsyncStorage.getItem('userPhone');
    if (storedPhone) {
      setPhone(storedPhone);
      fetchData(storedPhone);
    } else {
      setPhone('');
      setProfile(null);
      setOrders([]);
    }
  };

  const fetchUserReviews = async (phoneNumber: string) => {
    try {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const res = await fetch(`${API_URL}/api/user/reviews/${cleanPhone}`);
        if (res.ok) {
            setUserReviews(await res.json());
        }
    } catch (e) { 
        // Ignore error
    }
  };

  const deleteUserReview = async (id: number) => {
      Alert.alert('Видалити відгук?', 'Цю дію неможливо скасувати', [
          { text: 'Ні', style: 'cancel' },
          { text: 'Так', style: 'destructive', onPress: async () => {
              try {
                  const res = await fetch(`${API_URL}/api/reviews/${id}`, { method: 'DELETE' });
                  if (res.ok) {
                      setUserReviews(prev => prev.filter(r => r.id !== id));
                      Alert.alert('Успіх', 'Відгук видалено');
                  }
              } catch (e) {
                  Alert.alert('Помилка', 'Не вдалося видалити відгук');
              }
          }}
      ]);
  };

  // 2. Загрузка данных
  const fetchData = async (phoneNumber: string) => {
    setLoading(true);
    setProfile(prev => prev ? { ...prev, city: undefined, warehouse: undefined } : null);
    setLocalCity('');
    setLocalWarehouse('');
    try {
      const resUser = await fetch(`${API_URL}/user/${phoneNumber}`);
      // Автоматический выход только при 401 от GET /api/user/me (в AuthContext.validateToken).
      // 401 от GET /user/{phone} не вызываем clearAllAuth — только сбрасываем локальное состояние.
      if (resUser.status === 401) {
        setPhone('');
        setProfile(null);
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (resUser.ok) {
        const user = await resUser.json();
        setProfile(user);
        // Локальные фолбэки для автозаполнения и вкладки «Інформація»
        if (user?.name) await AsyncStorage.setItem('userName', String(user.name));
        if (user?.email) await AsyncStorage.setItem('userEmail', String(user.email));
        if (user?.contact_preference && ['call', 'telegram', 'viber'].includes(user.contact_preference)) {
          await AsyncStorage.setItem('userContactPreference', String(user.contact_preference));
        }
        // Приоритет сервера: если сервер вернул null — очищаем локальные ключи и не оставляем старые значения
        if (user?.city != null && user?.city !== '') {
          await AsyncStorage.setItem('userCity', String(user.city));
          setLocalCity(String(user.city));
        } else {
          await AsyncStorage.removeItem('userCity');
          setLocalCity('');
        }
        if (user?.warehouse != null && user?.warehouse !== '') {
          await AsyncStorage.setItem('userWarehouse', String(user.warehouse));
          setLocalWarehouse(String(user.warehouse));
        } else {
          await AsyncStorage.removeItem('userWarehouse');
          setLocalWarehouse('');
        }
        if (user?.ukrposhta != null && user?.ukrposhta !== '') {
          await AsyncStorage.setItem('userUkrposhta', String(user.ukrposhta));
        } else {
          await AsyncStorage.removeItem('userUkrposhta');
        }
      }

      // Для соц. входу (google_*, fb_*) передаємо як є; для телефону — лише цифри
      const ordersPhone = phoneNumber.startsWith('google_') || phoneNumber.startsWith('tg_')
        ? phoneNumber
        : phoneNumber.replace(/\D/g, '');
      const resOrders = await fetch(`${API_URL}/api/client/orders/${ordersPhone}`);
      if (resOrders.ok) {
        const ordersData = await resOrders.json();
        setOrders(ordersData);
        // Для онлайн-оплати: відправити purchase після підтвердження (статус Paid/Оплачено), один раз на замовлення
        const paidStatuses = ['Paid', 'Оплачено'];
        const trackedJson = await AsyncStorage.getItem(PURCHASE_TRACKED_ORDER_IDS_KEY).catch(() => null);
        const trackedIds: number[] = trackedJson ? JSON.parse(trackedJson) : [];
        let changed = false;
        for (const order of ordersData) {
          if (paidStatuses.includes(order.status) && order.id != null && !trackedIds.includes(Number(order.id))) {
            const orderItems = order.items ?? [];
            const total = order.totalPrice ?? order.total_price ?? 0;
            trackPurchase(String(order.id), orderItems, Number(total), 0, undefined);
            logFirebaseEvent('purchase', {
              currency: 'UAH',
              value: Number(total),
              transaction_id: String(order.id),
              items: (orderItems as any[]).map((i: any) => ({
                item_id: String(i.id ?? i.product_id ?? ''),
                item_name: i.name ?? i.title ?? '',
                price: Number(i.price ?? 0),
                quantity: Number(i.quantity ?? 1),
              })),
            });
            trackedIds.push(Number(order.id));
            changed = true;
          }
        }
        if (changed) {
          await AsyncStorage.setItem(PURCHASE_TRACKED_ORDER_IDS_KEY, JSON.stringify(trackedIds));
        }
      }

      // Load reviews (тільки для входу по телефону)
      if (!phoneNumber.startsWith('google_') && !phoneNumber.startsWith('tg_')) fetchUserReviews(ordersPhone);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 3. Логика входа / выхода
  const handleLogin = async () => {
    if (inputPhone.length < 10) {
      Alert.alert('Помилка', 'Введіть коректний номер (напр. 0991234567)');
      return;
    }

    try {
      // Регистрируем или получаем пользователя
      const res = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: inputPhone })
      });

      if (res.ok) {
        const user = await res.json();
        await AsyncStorage.setItem('userPhone', inputPhone);
        if (user.name) {
            await AsyncStorage.setItem('userName', user.name);
        }
        setPhone(inputPhone);
        setProfile(user); // Сразу ставим профиль
        setShowLoginModal(false);
        savePushTokenForUser(inputPhone, false); // вхід по телефону — привітальний пуш не шлемо (тільки при sign_up)
        fetchData(inputPhone); // Подгружаем заказы и обновляем
      } else {
        Alert.alert('Помилка', 'Сервер не відповідає');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Помилка', 'Немає з\'єднання');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Вихід', 'Ви впевнені?', [
      { text: 'Ні', style: 'cancel' },
      {
        text: 'Так',
        style: 'destructive',
        onPress: async () => {
          await clearAllAuth();
          await SecureStore.deleteItemAsync(STORAGE_JWT_KEY);
          setPhone('');
          setProfile(null);
          setOrders([]);
          setInputPhone('');
          setInfoName('');
          setInfoCity('');
          setInfoWarehouse('');
          setInfoUkrposhta('');
          setLocalCity('');
          setLocalWarehouse('');
          setInfoEmail('');
          setInfoContactPreference('call');
        }
      }
    ]);
  };

  /* 🔥 UPDATE USER INFO */
  const openInfoModal = async () => {
    if (!profile) {
      Alert.alert('Увага', 'Спочатку увійдіть в акаунт');
      return;
    }

    // Fallback на локально сохранённые данные только для name, email, contact (город и отделение — только из profile с сервера)
    let localName = '';
    let localEmail = '';
    let localContact: 'call' | 'telegram' | 'viber' | '' = '';
    try {
      const saved = await AsyncStorage.getItem('savedCheckoutInfo');
      if (saved) {
        const parsed = JSON.parse(saved);
        localName = String(parsed?.name || '');
        localEmail = String(parsed?.email || '');
        const cp = parsed?.contact_preference;
        if (cp && ['call', 'telegram', 'viber'].includes(cp)) localContact = cp;
      }

      if (!localEmail) {
        localEmail = String((await AsyncStorage.getItem('userEmail')) || '');
      }
      if (!localContact) {
        const storedContact = await AsyncStorage.getItem('userContactPreference');
        if (storedContact && ['call', 'telegram', 'viber'].includes(storedContact)) {
          localContact = storedContact as 'call' | 'telegram' | 'viber';
        }
      }
    } catch (e) {
      // Ignore parse errors
    }

    setInfoName(profile.name || localName || '');
    setInfoCity(profile.city || '');
    setInfoWarehouse(profile.warehouse || '');
    setInfoUkrposhta(profile.ukrposhta || '');
    setInfoEmail(profile.email || localEmail || '');
    setInfoContactPreference((profile.contact_preference as any) || (localContact as any) || 'call');
    const isSocialId = phone.startsWith('google_') || phone.startsWith('tg_');
    setInfoPhone(isSocialId ? '' : (phone || ''));
    setInfoModalVisible(true);
  };

  const saveUserInfo = async () => {
    const cleanWarehouse = (v: string) => v.replace(/\s*Нова\s+[Пп]очта\s*:?\s*/gi, '').replace(/\s*Укрпошта\s*:?\s*/gi, '').trim();
    const wh = cleanWarehouse(infoWarehouse);
    const ukr = cleanWarehouse(infoUkrposhta);
    const isSocialId = phone.startsWith('google_') || phone.startsWith('tg_');
    let normalizedPhone: string | undefined;
    if (infoPhone.trim()) {
      const digits = infoPhone.replace(/\D/g, '');
      normalizedPhone = digits.startsWith('380') ? digits : digits.startsWith('0') ? '38' + digits : '380' + digits;
      if (normalizedPhone.length < 12) {
        Alert.alert('Помилка', 'Введіть коректний номер телефону (наприклад +380 XX XXX XX XX)');
        return;
      }
    }
    try {
      const body: Record<string, unknown> = {
            name: infoName,
            city: infoCity,
            warehouse: wh || undefined,
            user_ukrposhta: ukr || undefined,
            email: infoEmail,
            contact_preference: infoContactPreference
      };
      if (isSocialId && normalizedPhone) body.phone = normalizedPhone;
      const res = await fetch(`${API_URL}/api/user/info/${phone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok && profile) {
        if (isSocialId && normalizedPhone) {
          await AsyncStorage.setItem('userPhone', normalizedPhone);
          setPhone(normalizedPhone);
        }
        setProfile({ ...profile, name: infoName, city: infoCity, warehouse: wh || undefined, ukrposhta: ukr || undefined, email: infoEmail, contact_preference: infoContactPreference });
        await AsyncStorage.setItem('userName', infoName);
        if (infoEmail) await AsyncStorage.setItem('userEmail', infoEmail);
        await AsyncStorage.setItem('userContactPreference', infoContactPreference);
        if (infoCity) await AsyncStorage.setItem('userCity', infoCity);
        if (wh) await AsyncStorage.setItem('userWarehouse', wh);
        if (ukr) await AsyncStorage.setItem('userUkrposhta', ukr);
        else await AsyncStorage.removeItem('userUkrposhta');
        const savedPhone = isSocialId && normalizedPhone ? normalizedPhone : phone;
        await AsyncStorage.setItem('savedCheckoutInfo', JSON.stringify({
          name: infoName,
          phone: savedPhone,
          email: infoEmail,
          contact_preference: infoContactPreference,
          city: infoCity ? { ref: '', name: infoCity } : { ref: '', name: '' },
          warehouse: wh ? { ref: '', name: wh } : { ref: '', name: '' },
          ukrposhta: ukr || undefined
        }));
        
        setInfoModalVisible(false);
        Alert.alert('Успіх', 'Дані оновлено');
        if (isSocialId && normalizedPhone) fetchData(normalizedPhone);
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти дані');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Помилка', 'Немає з\'єднання');
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    if (phone) fetchData(phone);
    else setTimeout(() => setRefreshing(false), 1000);
  }, [phone]);

  // 4. Поделиться
  const handleShare = async () => {
    if (!phone || phone.startsWith('google_') || phone.startsWith('tg_')) {
      Alert.alert(
        'Потрібен номер телефону',
        'Вкажіть номер телефону в особистих даних або при оформленні замовлення, щоб користуватися реферальною програмою.'
      );
      return;
    }
    try {
      await Share.share({
        message: `Привіт! Тримай від мене 50 грн на покупки в Dikoros UA! \nВкажи мій номер ${phone} при замовленні.`,
      });
    } catch (error: any) { console.log(error.message); }
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  const openInAppBrowser = (url: string) => {
    WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET }).catch(() => openLink(url));
  };

  // Офіційні сторінки сайту (інфо-розділи)
  const SITE_PAGES = {
    paymentDelivery: 'https://dikoros.ua/oplata-i-dostavka/',
    exchangeReturn: 'https://dikoros.ua/obmin-ta-povernennya/',
    offer: 'https://dikoros.ua/dohovir-oferty/',
    aboutUs: 'https://dikoros.ua/pro-nas/',
    promotions: 'https://dikoros.ua/aktsii/',
  };

  const showDevAlert = () => {
    Alert.alert('В розробці', 'Цей розділ з\'явиться у наступних оновленнях');
  };

  const GridBtn = ({ icon, label, onPress, color = Colors.light.tint }: any) => (
    <TouchableOpacity style={styles.gridItem} onPress={onPress}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={styles.gridText}>{label}</Text>
    </TouchableOpacity>
  );

  const MenuSection = ({ title, titleNote, children }: any) => (
    <View style={styles.menuSection}>
      {title && (
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeader}>{title}</Text>
          {titleNote ? <Text style={styles.sectionHeaderNote}>{titleNote}</Text> : null}
        </View>
      )}
      <View style={styles.menuList}>
        {children}
      </View>
    </View>
  );

  const MenuItemWithIcon = ({ icon, label, subtitle, isLast = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; subtitle?: string; isLast?: boolean; onPress: () => void }) => (
    <View>
      <TouchableOpacity style={styles.menuItemWithIcon} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.menuItemIconWrap}>
          <Ionicons name={icon} size={22} color={Colors.light.tint} />
        </View>
        <View style={styles.menuItemWithIconContent}>
          <Text style={styles.menuItemWithIconLabel}>{label}</Text>
          {subtitle ? <Text style={styles.menuItemWithIconSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </View>
  );

  // === ОБЩИЙ КОНТЕНТ ===
  const renderCommonMenu = () => (
    <>
      {/* СЕТКА БЫСТРЫХ ДЕЙСТВИЙ */}
      <View style={styles.gridContainer}>
        <GridBtn icon="receipt-outline" label="Замовлення" onPress={() => router.push('/(tabs)/orders')} />
        <GridBtn icon="chatbubble-ellipses-outline" label="Чат" onPress={() => router.push('/(tabs)/chat')} />
        <GridBtn icon="heart-outline" label="Мої списки" onPress={() => router.push('/(tabs)/favorites')} />
        <GridBtn icon="person-outline" label="Інформація" onPress={openInfoModal} />
      </View>

      {/* Зв'язок та допомога */}
      <MenuSection title="Зв'язок та допомога">
        <MenuItemWithIcon
          icon="call"
          label="Зателефонувати нам"
          subtitle="(063) 25 26 8 24 · +380 63 252 68 24"
          onPress={() => openLink('tel:+380632526824')}
        />
        <MenuItemWithIcon
          icon="chatbubbles"
          label="Написати у Viber/WhatsApp"
          subtitle="+380 63 252 68 24"
          onPress={() => openLink('https://wa.me/380632526824')}
        />
        <MenuItemWithIcon
          icon="mail"
          label="Надіслати Email"
          subtitle="dikorosua@gmail.com"
          onPress={() => openLink('mailto:dikorosua@gmail.com')}
        />
        <MenuItemWithIcon
          icon="pin"
          label="Наша адреса"
          subtitle="с. Жавинка, вул. Іллінська, 2а (Чернігівська обл.)"
          isLast
          onPress={() => openLink('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Жавинка Іллінська 2а Чернігівська обл'))}
        />
      </MenuSection>

      {/* Політики та документи — над оплатою і доставкою */}
      <MenuSection title="Політики та документи" titleNote="Правова інформація та інформація про компанію">
        <MenuItemWithIcon
          icon="card"
          label="Оплата і доставка"
          onPress={() => openInAppBrowser(SITE_PAGES.paymentDelivery)}
        />
        <MenuItemWithIcon
          icon="swap-horizontal"
          label="Обмін та повернення"
          onPress={() => openInAppBrowser(SITE_PAGES.exchangeReturn)}
        />
        <MenuItemWithIcon
          icon="document-text"
          label="Договір оферти"
          onPress={() => openInAppBrowser(SITE_PAGES.offer)}
        />
        <MenuItemWithIcon
          icon="information-circle"
          label="Про Dikoros"
          isLast
          onPress={() => openInAppBrowser(SITE_PAGES.aboutUs)}
        />
      </MenuSection>

      {/* СПИСКИ МЕНЮ — тільки заповнені розділи */}
      <MenuSection title="Бонуси та знижки">
        <MenuItemWithIcon
          icon="pricetag"
          label="Знижки та акції"
          isLast
          onPress={() => openInAppBrowser(SITE_PAGES.promotions)}
        />
      </MenuSection>

      <MenuSection title="Моя активність">
        <MenuItemWithIcon
          icon="star"
          label="Мої відгуки"
          isLast
          onPress={() => setReviewsModalVisible(true)}
        />
      </MenuSection>

      <View style={{height: 50}} />
    </>
  );

  // === ЭКРАН ГОСТЯ ===
  const renderGuestView = () => (
    <View style={styles.container}>
      {/* HEADER FIXED */}
      <View style={{ 
          height: 60 + insets.top, 
          backgroundColor: 'white', 
          borderBottomWidth: 1, 
          borderBottomColor: '#f0f0f0',
          paddingTop: insets.top 
      }}>
        <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, justifyContent: 'center', alignItems: 'center', ...(Platform.OS === 'ios' ? { zIndex: 1 } : null) }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1F2937' }}>Профіль</Text>
         </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <View style={styles.welcomeBlock}>
        <Text style={styles.welcomeTitle}>Вітаємо в DikorosUA!</Text>
        <Text style={styles.welcomeSubtitle}>
          Авторизуйтесь, щоб керувати замовленнями, отримувати кешбек та персональні знижки.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowLoginModal(true)}>
          <Text style={styles.primaryBtnText}>Увійти / Створити акаунт</Text>
        </TouchableOpacity>
      </View>

      {renderCommonMenu()}
      </ScrollView>
    </View>
  );

  // === СКЕЛЕТОН ПРОФІЛЮ (завантаження даних) ===
  const renderProfileSkeleton = () => (
    <View style={styles.container}>
      <View style={{ height: 60 + insets.top, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingTop: insets.top }}>
        <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1F2937' }}>Профіль</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={[styles.bonusCard, { minHeight: 140 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <View style={{ width: 120, height: 14, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, marginBottom: 8 }} />
              <View style={{ width: 80, height: 24, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 4 }} />
            </View>
            <View style={{ width: 90, height: 24, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 8 }} />
          </View>
          <View style={{ marginTop: 16, height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, width: '70%' }} />
          <View style={{ marginTop: 8, height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, width: '50%' }} />
        </View>
        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={{ marginTop: 12, fontSize: 14, color: '#666' }}>Завантаження профілю...</Text>
        </View>
      </ScrollView>
    </View>
  );

  // === ЭКРАН КЛИЕНТА ===
  const renderUserView = () => {
    // 🔥 РАСЧЕТ УРОВНЕЙ ЛОЯЛЬНОСТИ
    const totalSpent = profile?.total_spent || 0;
    
    // Визначаємо поточний рівень кешбеку згідно з таблицею умов
    let currentPercent = 0;
    let nextLevel = 2000;
    let nextPercent = 5;
    let prevLevel = 0;

    if (totalSpent < 2000) {
      currentPercent = 0;
      nextLevel = 2000;
      nextPercent = 5;
      prevLevel = 0;
    } else if (totalSpent < 5000) {
      currentPercent = 5;
      nextLevel = 5000;
      nextPercent = 10;
      prevLevel = 2000;
    } else if (totalSpent < 10000) {
      currentPercent = 10;
      nextLevel = 10000;
      nextPercent = 15;
      prevLevel = 5000;
    } else if (totalSpent < 25000) {
      currentPercent = 15;
      nextLevel = 25000;
      nextPercent = 20;
      prevLevel = 10000;
    } else {
      currentPercent = 20;
      nextLevel = 0;
      nextPercent = 20;
      prevLevel = 25000;
    }

    // Считаем % заполнения шкалы (относительно текущего диапазона)
    const progressPercent = nextLevel > 0 
        ? Math.min(((totalSpent - prevLevel) / (nextLevel - prevLevel)) * 100, 100) 
        : 100;

    return (

        <View style={styles.container}>
          {/* HEADER FIXED */}
          <View style={{ 
              height: 60 + insets.top, 
              backgroundColor: 'white', 
              borderBottomWidth: 1, 
              borderBottomColor: '#f0f0f0',
              paddingTop: insets.top 
          }}>
             {/* Center Title */}
             <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: 60, justifyContent: 'center', alignItems: 'center', ...(Platform.OS === 'ios' ? { zIndex: 1 } : null) }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1F2937' }}>Профіль</Text>
             </View>

             {/* Right Button */}
             <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, ...(Platform.OS === 'ios' ? { zIndex: 2 } : null) }}>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                  <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                </TouchableOpacity>
             </View>
          </View>

          <ScrollView 
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >


            {/* ЧЕРНАЯ КАРТОЧКА */}
            <View style={styles.bonusCard}>
                {/* ВЕРХНЯЯ ЧАСТЬ: БАЛАНС + БЕЙДЖ */}
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <View>
                    <Text style={styles.bonusLabel}>Доступні бонуси</Text>
                    <Text style={styles.bonusValue}>{profile?.bonus_balance || 0} ₴</Text>
                    </View>
                    {/* Бейдж кешбэка */}
                    <View style={styles.cashbackBadge}>
                    <Text style={styles.cashbackText}>{currentPercent}% Кешбек</Text>
                    </View>
                </View>

                {/* ПРОГРЕСС БАР */}
                <View style={styles.progressSection}>
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5, alignItems: 'center'}}>
                        <Text style={styles.progressText}>
                            Всього витрачено: <Text style={{fontWeight: 'bold', color: '#FFF'}}>{totalSpent} ₴</Text>
                        </Text>
                        {/* 🔥 КНОПКА УМОВИ */}
                        <TouchableOpacity onPress={() => setModalVisible(true)}>
                            <Text style={{color: Colors.light.tint, fontSize: 12, fontWeight: 'bold'}}>ⓘ Умови</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, {width: `${progressPercent}%`}]} />
                    </View>
                    
                    {/* 🔥 ТЕКСТ О СЛЕДУЮЩЕМ УРОВНЕ */}
                    <Text style={styles.progressSubtext}>
                    {nextLevel > 0 
                        ? `Поточний рівень: ${currentPercent}%. Ще ${nextLevel - totalSpent} ₴ до ${nextPercent}%` 
                        : `Ви досягли максимального рівня кешбеку! 🎉`}
                    </Text>
                </View>
            </View>

            {/* Кнопка Рефералки */}
            <TouchableOpacity style={styles.inviteBanner} onPress={handleShare}>
                <Ionicons name="gift" size={24} color="#FFF" />
                <Text style={styles.inviteText}>Запросити друга (+50 грн)</Text>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
            </TouchableOpacity>

            {/* ОСНОВНОЕ МЕНЮ */}
            <View style={{marginTop: 20}}>
                {renderCommonMenu()}
            </View>
          </ScrollView>
        </View>
    );
  };

  return (
    <View style={{flex: 1, backgroundColor: '#F4F4F4'}}>
      {phone && profile
        ? renderUserView()
        : phone && loading
          ? renderProfileSkeleton()
          : renderGuestView()}
      
      <FloatingChatButton bottomOffset={30} />

      {/* МОДАЛКА ВХОДА */}
      <Modal visible={showLoginModal} animationType="slide" transparent onRequestClose={() => setShowLoginModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.modalContentLogin]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleLogin} numberOfLines={1}>Вітаємо в DikorosUA</Text>
              <TouchableOpacity style={styles.modalCloseHitArea} onPress={() => setShowLoginModal(false)}>
                <Ionicons name="close" size={26} color="#111" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitleLogin}>
              Увійдіть, щоб отримати 150 грн бонусів та доступ до історії замовлень
            </Text>

            {socialLoading ? (
              <View style={styles.socialLoader}>
                <ActivityIndicator size="small" color={Colors.light.tint} />
                <Text style={styles.socialLoaderText}>Авторизація...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.googleButtonLogin, (!googleRequest || socialLoading) && styles.googleButtonDisabled]}
                onPress={signInWithGoogle}
                disabled={!!socialLoading || !googleRequest}
              >
                <View style={styles.googleButtonIconLogin}>
                  <Ionicons name="logo-google" size={22} color="#4285F4" />
                </View>
                <Text style={styles.googleButtonTextLogin}>Увійти через Google</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Phone popup removed — phone is collected in checkout */}

      {/* 🔥 МОДАЛКА ТАБЛИЦЫ КЕШБЭКА */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Рівні кешбеку</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.table}>
                <View style={[styles.tr, {backgroundColor: '#F5F5F5'}]}>
                    <Text style={[styles.th, {flex: 1}]}>Сума покупок</Text>
                    <Text style={[styles.th, {width: 60, textAlign: 'right'}]}>%</Text>
                </View>
                <View style={styles.tr}><Text style={styles.td}>0 - 1 999 ₴</Text><Text style={styles.tdR}>0%</Text></View>
                <View style={styles.tr}><Text style={styles.td}>2 000 - 4 999 ₴</Text><Text style={styles.tdR}>5%</Text></View>
                <View style={styles.tr}><Text style={styles.td}>5 000 - 9 999 ₴</Text><Text style={styles.tdR}>10%</Text></View>
                <View style={styles.tr}><Text style={styles.td}>10 000 - 24 999 ₴</Text><Text style={styles.tdR}>15%</Text></View>
                <View style={[styles.tr, {borderBottomWidth:0}]}><Text style={styles.td}>від 25 000 ₴</Text><Text style={styles.tdR}>20%</Text></View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔥 INFO MODAL */}
      <Modal visible={infoModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Особиста інформація</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              <Text style={{marginBottom: 5, color: '#666'}}>Телефон</Text>
              <TextInput
                style={styles.input}
                value={infoPhone}
                onChangeText={setInfoPhone}
                placeholder="+380 XX XXX XX XX"
                keyboardType="phone-pad"
              />

              <Text style={{marginBottom: 5, color: '#666'}}>Ім&apos;я та Прізвище</Text>
              <TextInput style={styles.input} value={infoName} onChangeText={setInfoName} placeholder="Іван Іванов" />

              <Text style={{marginBottom: 5, color: '#666'}}>Місто</Text>
              <TextInput style={styles.input} value={infoCity} onChangeText={setInfoCity} placeholder="Київ" />

              <Text style={{marginBottom: 5, color: '#666'}}>Відділення Нової Пошти</Text>
              <TextInput style={styles.input} value={infoWarehouse} onChangeText={setInfoWarehouse} placeholder="№1 або адреса" />

              <Text style={{marginBottom: 5, color: '#666'}}>Відділення Укрпошти</Text>
              <TextInput style={styles.input} value={infoUkrposhta} onChangeText={setInfoUkrposhta} placeholder="Індекс, місто, адреса" />

              <Text style={{marginBottom: 5, color: '#666'}}>Email (не обов&apos;язково)</Text>
              <TextInput
                style={styles.input}
                value={infoEmail}
                onChangeText={setInfoEmail}
                placeholder="example@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={{marginBottom: 5, color: '#666'}}>Зручний спосіб зв&apos;язку</Text>
              <View style={{flexDirection: 'row', gap: 8, marginBottom: 15}}>
                <TouchableOpacity
                  style={[styles.contactChip, infoContactPreference === 'call' && styles.contactChipActive]}
                  onPress={() => setInfoContactPreference('call')}
                >
                  <Text style={[styles.contactChipText, infoContactPreference === 'call' && styles.contactChipTextActive]}>📞 Дзвінок</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.contactChip, infoContactPreference === 'telegram' && styles.contactChipActive]}
                  onPress={() => setInfoContactPreference('telegram')}
                >
                  <Text style={[styles.contactChipText, infoContactPreference === 'telegram' && styles.contactChipTextActive]}>✈️ Telegram</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.contactChip, infoContactPreference === 'viber' && styles.contactChipActive]}
                  onPress={() => setInfoContactPreference('viber')}
                >
                  <Text style={[styles.contactChipText, infoContactPreference === 'viber' && styles.contactChipTextActive]}>💬 Viber</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.loginButton} onPress={saveUserInfo}>
                <Text style={styles.loginButtonText}>Зберегти</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🔥 REVIEWS MODAL */}
      <Modal visible={reviewsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {height: '80%'}]}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Мої відгуки</Text>
                    <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                </View>

                {userReviews.length === 0 ? (
                    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                        <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
                        <Text style={{color: '#999', marginTop: 10}}>У вас поки немає відгуків</Text>
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {userReviews.map((review, index) => (
                            <View key={review.id || index} style={{
                                backgroundColor: '#F9F9F9',
                                padding: 15,
                                borderRadius: 12,
                                marginBottom: 15
                            }}>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10}}>
                                    <View style={{flex: 1}}>
                                        <Text style={{fontWeight: 'bold', fontSize: 16, marginBottom: 4}}>
                                            {review.product_name || 'Товар'}
                                        </Text>
                                        <View style={{flexDirection: 'row', marginBottom: 5}}>
                                            {[1,2,3,4,5].map(star => (
                                                <Ionicons 
                                                    key={star} 
                                                    name={star <= review.rating ? "star" : "star-outline"} 
                                                    size={16} 
                                                    color="#FFD700" 
                                                />
                                            ))}
                                        </View>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => deleteUserReview(review.id)}
                                        style={{padding: 5}}
                                    >
                                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                    </TouchableOpacity>
                                </View>

                                {review.comment && (
                                    <Text style={{color: '#444', fontSize: 14, lineHeight: 20, marginBottom: 8}}>
                                        {review.comment}
                                    </Text>
                                )}
                                
                                <Text style={{color: '#999', fontSize: 12}}>
                                    {new Date(review.created_at).toLocaleDateString('uk-UA')}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  // GUEST
  guestHeader: { backgroundColor: Colors.light.tint, padding: 20, paddingTop: 60, alignItems: 'center' },
  guestTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  
  welcomeBlock: { backgroundColor: '#FFF', padding: 20, marginBottom: 10 },
  welcomeTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  welcomeSubtitle: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20 },
  primaryBtn: { backgroundColor: Colors.light.tint, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // GRID
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 10, justifyContent: 'space-between' },
  gridItem: { 
    width: '48%', backgroundColor: '#FFF', paddingVertical: 15, paddingHorizontal: 10, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
    borderWidth: 1, borderColor: '#E0E0E0'
  },
  gridText: { fontSize: 13, fontWeight: '600', color: '#333' },

  // LIST SECTIONS
  menuSection: { marginTop: 15 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginLeft: 15, marginBottom: 10, color: '#333' },
  sectionHeaderWrap: { marginLeft: 15, marginBottom: 10 },
  sectionHeaderNote: { fontSize: 12, color: '#888', marginTop: 2 },
  menuList: { backgroundColor: '#FFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEE' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  menuItemText: { fontSize: 16, color: '#333' },
  menuItemWithIcon: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  menuItemIconWrap: { width: 36, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuItemWithIconContent: { flex: 1 },
  menuItemWithIconLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  menuItemWithIconSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginLeft: 20 },
  
  // USER DASHBOARD
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  headerPhone: { color: '#666', fontSize: 14 },
  logoutBtn: { padding: 5 },

  // BLACK CARD
  bonusCard: { margin: 15, padding: 20, backgroundColor: '#222', borderRadius: 16 },
  bonusLabel: { color: '#AAA', fontSize: 14, marginBottom: 5 },
  bonusValue: { color: '#FFF', fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  cashbackBadge: { backgroundColor: '#444', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  cashbackText: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },

  progressSection: { marginTop: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#444' },
  progressText: { fontSize: 14, color: '#CCC' },
  progressBarBg: { height: 6, backgroundColor: '#555', borderRadius: 3, marginVertical: 8 },
  progressBarFill: { height: 6, backgroundColor: Colors.light.tint, borderRadius: 3 },
  progressSubtext: { fontSize: 12, color: '#AAA' },

  inviteBanner: { marginHorizontal: 15, backgroundColor: '#FF9800', borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  inviteText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 15, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: 15 },
  
  orderItem: { backgroundColor: '#FFF', marginHorizontal: 15, marginBottom: 10, padding: 15, borderRadius: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  orderId: { fontWeight: 'bold' },
  orderDate: { color: '#888', fontSize: 12 },
  orderTotal: { fontWeight: 'bold', fontSize: 16 },
  statusText: { fontSize: 14, fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 10 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, paddingBottom: 40, minHeight: 300, maxHeight: '80%', marginHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalTitlePhone: { fontSize: 22, fontWeight: '800' },
  modalSubtitle: { color: '#666', marginBottom: 20 },
  modalSubtitlePhone: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 20 },
  modalContentLogin: {
    backgroundColor: '#FFF',
    borderRadius: 32,
    padding: 30,
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
  },
  modalTitleLogin: { fontSize: 24, fontWeight: '800', color: '#111', flex: 1 },
  modalSubtitleLogin: { color: '#666', marginTop: 8, marginBottom: 25, fontSize: 15, lineHeight: 22 },
  modalCloseHitArea: { padding: 12 },
  modalContentPhone: {
    borderRadius: 24,
    padding: 24,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 15, fontSize: 18, marginBottom: 20 },
  phoneInput: {
    height: 56,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  loginButton: { backgroundColor: Colors.light.tint, padding: 16, borderRadius: 10, alignItems: 'center' },
  loginButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  phoneSubmitButton: { paddingVertical: 18, borderRadius: 14 },

  socialDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  socialDividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  socialDividerText: { marginHorizontal: 12, fontSize: 13, color: '#888' },
  socialLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  socialLoaderText: { fontSize: 14, color: '#666' },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  socialButtonIcon: { width: 28, alignItems: 'center', marginRight: 12 },
  socialButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    width: '100%',
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  googleButtonLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    width: '100%',
    backgroundColor: '#4285F4',
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  googleButtonIconLogin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleButtonTextLogin: { fontSize: 16, fontWeight: '600', color: '#FFF' },

  // TABLE STYLES
  table: { borderWidth: 1, borderColor: '#EEE', borderRadius: 8, overflow: 'hidden' },
  tr: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  th: { fontWeight: 'bold', color: '#333', fontSize: 14 },
  td: { fontSize: 14, color: '#555', flex: 1 },
  tdR: { fontSize: 14, fontWeight: 'bold', width: 60, textAlign: 'right' },

  // CONTACT PREFERENCE CHIPS
  contactChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F0F0F0', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  contactChipActive: { backgroundColor: 'rgba(46,125,50,0.08)', borderColor: Colors.light.tint },
  contactChipText: { fontSize: 12, color: '#333', fontWeight: '500' },
  contactChipTextActive: { color: Colors.light.tint, fontWeight: 'bold' }
});