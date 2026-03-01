import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '@/config/api';
import { Colors } from '@/constants/theme';
import { STORAGE_JWT_KEY, useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useUserProfile } from '@/context/UserProfileContext';
import * as SecureStore from 'expo-secure-store';

/** Преобразует любое значение в строку для Alert (объекты/массивы от API не приводят к падению). */
function toAlertMessage(value: unknown): string {
  if (value == null || value === '') return 'Произошла ошибка';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Извлекает строку URL из ответа сервера (поле может быть строкой или объектом с url). */
function getPaymentUrl(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (raw && typeof raw === 'object' && 'url' in raw && typeof (raw as { url: string }).url === 'string') {
    return (raw as { url: string }).url;
  }
  return undefined;
}

export default function CheckoutScreen() {
  const popularCities = [
    { name: 'Київ', ref: '8d5a980d-391c-11dd-90d9-001a92567626' },
    { name: 'Львів', ref: 'db5c88e5-391c-11dd-90d9-001a92567626' },
    { name: 'Одеса', ref: 'db5c88d0-391c-11dd-90d9-001a92567626' },
    { name: 'Дніпро', ref: 'db5c88ee-391c-11dd-90d9-001a92567626' },
    { name: 'Харків', ref: 'db5c88e0-391c-11dd-90d9-001a92567626' },
    { name: 'Івано-Франківськ', ref: 'db5c889a-391c-11dd-90d9-001a92567626' },
  ];

  const router = useRouter();
  const { items, totalPrice, finalPrice, clearCart } = useCart() as any;

  // Поля формы
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); // ✅ NEW: Optional Email
  const [accountPhone, setAccountPhone] = useState('');
  const [contactMethod, setContactMethod] = useState<'call' | 'telegram' | 'viber'>('call'); // ✅ NEW: Contact Method

  const [deliveryMethod, setDeliveryMethod] = useState<'nova_poshta' | 'ukrposhta'>('nova_poshta');
  const [city, setCity] = useState({ ref: '', name: '' });
  const [warehouse, setWarehouse] = useState({ ref: '', name: '' });
  const [ukrCity, setUkrCity] = useState('');
  const [ukrIndex, setUkrIndex] = useState('');
  const [ukrAddress, setUkrAddress] = useState('');
  const [modalVisible, setModalVisible] = useState<'city' | 'warehouse' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const { userProfile, profileLoading, fetchUserInfo, updateBalanceFromAPI } = useUserProfile();
  useAuth();
  const bonusesFromProfile = userProfile?.bonuses ?? userProfile?.bonus_balance ?? 0;
  const [useBonuses, setUseBonuses] = useState(false);
  const [saveUserData, setSaveUserData] = useState(false);

  // Відділення обрано (Нова Пошта: місто+відділення; Укрпошта: індекс+місто+адреса)
  const isBranchSelected = deliveryMethod === 'nova_poshta'
    ? !!(city?.name && warehouse?.name)
    : !!(ukrCity?.trim() && ukrIndex?.trim() && ukrAddress?.trim());

  useEffect(() => {
    const run = async () => {
      await fetchUserInfo();
      loadUserData();
    };
    run();
  }, [fetchUserInfo]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        await updateBalanceFromAPI();
        if (!cancelled) setUseBonuses(false);
      })();
      return () => { cancelled = true; };
    }, [updateBalanceFromAPI])
  );

  useEffect(() => {
    if (profileLoading) return;
    const balance = userProfile?.bonuses ?? userProfile?.bonus_balance ?? 0;
    if (useBonuses && balance <= 0) setUseBonuses(false);
  }, [userProfile, profileLoading, useBonuses]);

  const loadUserData = async () => {
    try {
      const storedPhone = await AsyncStorage.getItem('userPhone');
      if (storedPhone) {
        setPhone(storedPhone);
        setAccountPhone(storedPhone);
        fetchUserData(storedPhone);
      }

      const savedInfo = await AsyncStorage.getItem('savedCheckoutInfo');
      if (savedInfo) {
        const parsed = JSON.parse(savedInfo);
        if (parsed.name) setName(parsed.name);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.email) setEmail(parsed.email); // Load saved email
        if (parsed.contact_preference && ['call', 'telegram', 'viber'].includes(parsed.contact_preference)) {
          setContactMethod(parsed.contact_preference);
        }
        if (parsed.city) setCity(parsed.city);
        if (parsed.warehouse) setWarehouse(parsed.warehouse);
        if (parsed.deliveryMethod === 'nova_poshta' || parsed.deliveryMethod === 'ukrposhta') {
          setDeliveryMethod(parsed.deliveryMethod);
        }
        if (parsed.ukrCity) setUkrCity(parsed.ukrCity);
        if (parsed.ukrIndex) setUkrIndex(parsed.ukrIndex);
        if (parsed.ukrAddress) setUkrAddress(parsed.ukrAddress);
        setSaveUserData(true);
      } else {
        const storedUkr = await AsyncStorage.getItem('userUkrposhta');
        if (storedUkr) {
          const parts = storedUkr.split(',').map((p: string) => p.trim());
          if (parts.length >= 3) {
            setUkrIndex(parts[0]);
            setUkrCity(parts[1]);
            setUkrAddress(parts.slice(2).join(', '));
          } else if (parts.length === 1) setUkrAddress(parts[0]);
        }
        // Fallback: якщо savedCheckoutInfo відсутній
        const storedEmail = await AsyncStorage.getItem('userEmail');
        if (storedEmail) setEmail(storedEmail);
        const storedContact = await AsyncStorage.getItem('userContactPreference');
        if (storedContact && ['call', 'telegram', 'viber'].includes(storedContact)) {
          setContactMethod(storedContact as 'call' | 'telegram' | 'viber');
        }
      }
    } catch (e) {
      // Ignore error
    }
  };

  const fetchUserData = async (phoneNumber: string) => {
    try {
      const res = await fetch(`${API_URL}/user/${phoneNumber}`);
      if (res.ok) {
        const data = await res.json();
        setAccountPhone(phoneNumber);
        if (data.email && !email) setEmail(data.email);
        if (data.name && !name) setName(data.name);
        if (data.city && !city.name) setCity({ ref: '', name: data.city });
        if (data.warehouse && !warehouse.name) setWarehouse({ ref: '', name: data.warehouse });
        if (data.ukrposhta && typeof data.ukrposhta === 'string') {
          const parts = data.ukrposhta.split(',').map((p: string) => p.trim());
          if (parts.length >= 3) {
            if (!ukrIndex) setUkrIndex(parts[0]);
            if (!ukrCity) setUkrCity(parts[1]);
            if (!ukrAddress) setUkrAddress(parts.slice(2).join(', '));
          } else if (parts.length === 1 && parts[0]) {
            if (!ukrAddress) setUkrAddress(parts[0]);
          }
        }
        if (data.contact_preference && ['call', 'telegram', 'viber'].includes(data.contact_preference)) {
          setContactMethod(data.contact_preference as 'call' | 'telegram' | 'viber');
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // --- Нова Пошта (через наш бэкенд: готовий масив [{ ref, name }]) ---
  const searchCity = async (searchText: string) => {
    setSearchQuery(searchText);
    if (searchText.length < 2) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const response = await fetch(`${API_URL}/api/delivery/cities?q=${encodeURIComponent(searchText)}`);
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  const loadWarehouses = async (cityRef?: string) => {
    const ref = cityRef ?? city.ref;
    if (!ref) return;
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      const response = await fetch(`${API_URL}/api/delivery/warehouses?city_ref=${encodeURIComponent(ref)}`);
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  const openModal = (type: 'city' | 'warehouse') => {
    setModalVisible(type);
    setSearchQuery('');
    setSearchResults([]);
    if (type === 'warehouse') {
      if (!city.ref) {
        Alert.alert("Увага", String("Спочатку оберіть місто!"));
        return;
      }
      loadWarehouses();
    }
  };

  const handleSelectCity = (item: { ref: string; name: string }) => {
    setCity(item);
    setWarehouse({ ref: '', name: '' });
    setSearchQuery('');
    setSearchResults([]);
    setModalVisible('warehouse');
    loadWarehouses(item.ref);
  };

  const handleSelect = (item: any) => {
    if (modalVisible === 'city') {
      handleSelectCity(item);
    } else {
      setWarehouse(item);
      setModalVisible(null);
    }
  };

  const handleSubmit = async () => {
    const isNovaPoshta = deliveryMethod === 'nova_poshta';

    if (
      !name ||
      !phone ||
      (isNovaPoshta
        ? (!city?.name || !warehouse?.name)
        : (!ukrCity?.trim() || !ukrIndex?.trim() || !ukrAddress?.trim()))
    ) {
      Alert.alert(
        'Увага',
        String(isNovaPoshta
          ? 'Будь ласка, заповніть всі поля:\n• Ім\'я\n• Телефон\n• Місто та Відділення'
          : 'Будь ласка, заповніть всі поля:\n• Ім\'я\n• Телефон\n• Місто / Село / СМТ\n• Поштовий індекс\n• Адреса доставки')
      );
      return;
    }

    setLoading(true);

    try {
    const shippingCity = isNovaPoshta ? city?.name : ukrCity;
    const shippingWarehouse = isNovaPoshta
      ? (warehouse?.name || '').trim()
      : [ukrIndex, ukrCity, ukrAddress].filter(Boolean).join(', ');
    const shippingCityRef = isNovaPoshta ? (city?.ref || "") : "";
    const shippingWarehouseRef = isNovaPoshta ? (warehouse?.ref || "") : "";

    if (saveUserData) {
      // Если пользователь явно просит «сохранить данные», считаем это согласием
      // на сохранение телефона для доступа к «Мої замовлення» и профилю.
      await AsyncStorage.setItem('savedCheckoutInfo', JSON.stringify({
        name,
        phone,
        email,
        contact_preference: contactMethod,
        city,
        warehouse,
        deliveryMethod,
        ukrCity,
        ukrIndex,
        ukrAddress,
      }));
      await AsyncStorage.setItem('userPhone', phone);
      await AsyncStorage.setItem('userName', name);
      if (email) await AsyncStorage.setItem('userEmail', email);
      await AsyncStorage.setItem('userContactPreference', contactMethod);
      if (shippingCity) await AsyncStorage.setItem('userCity', shippingCity);
      if (shippingWarehouse) {
        await AsyncStorage.setItem('userWarehouse', isNovaPoshta ? shippingWarehouse : '');
        if (!isNovaPoshta) await AsyncStorage.setItem('userUkrposhta', shippingWarehouse);
      }
    } else {
      await AsyncStorage.removeItem('savedCheckoutInfo');
    }

    const cleanItems = (items || []).map((item: any) => ({
        id: Number(item.id),
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        packSize: item.packSize || null,
        unit: item.unit || 'шт',
        variant_info: item?.label ?? item?.weight ?? null // ✅ Pass variant info
      }));

      // Використовуємо finalPrice з контексту (вже з урахуванням промокоду)
      const bonusesToUse = useBonuses ? Math.min(bonusesFromProfile ?? 0, finalPrice ?? 0) : 0;
      const finalPriceWithBonuses = Math.max(0, (finalPrice ?? 0) - bonusesToUse);

      // Бонуси передаються лише в об'єкті замовлення (bonus_used / applied_bonuses). Окремого запиту на списання немає — бекенд списує при підтвердженні (готівка) або після успішної оплати картою.
      // bonus_balance / total_spent опційні на бекенді (беруться з БД); передаємо для сумісності.
      const orderData = {
        name,
        user_phone: accountPhone,
        phone: phone,
        email: email || '', // ✅ Include Email
        contact_preference: contactMethod, // ✅ Include Contact Preference
        city: shippingCity, cityRef: shippingCityRef,
        warehouse: shippingWarehouse, warehouseRef: shippingWarehouseRef,
        delivery_method: deliveryMethod,
        items: cleanItems,
        totalPrice: Math.floor(finalPriceWithBonuses),
        payment_method: paymentMethod,
        bonus_used: bonusesToUse,
        applied_bonuses: bonusesToUse, // дубль для ясності; бекенд використовує bonus_used
        use_bonuses: useBonuses,
        bonus_balance: userProfile?.bonuses ?? userProfile?.bonus_balance ?? 0,
        total_spent: (userProfile as { total_spent?: number } | null)?.total_spent ?? 0,
      };

      let authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const token = await SecureStore.getItemAsync(STORAGE_JWT_KEY) || await AsyncStorage.getItem(STORAGE_JWT_KEY);
        if (token?.trim()) authHeaders['Authorization'] = `Bearer ${token.trim()}`;
      } catch {
        // ignore
      }

      const response = await fetch(`${API_URL}/create_order`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(orderData),
      });

      const contentType = response.headers.get('content-type');
      let result;

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const textResponse = await response.text();
        throw new Error(`Сервер повернув некоректну відповідь: ${textResponse.substring(0, 100)}`);
      }

      if (response.ok) {
        // Успіх: замовлення створено. Локально бонуси не списуємо — це робить бекенд (готівка при створенні, карта — у callback після оплати).
        // Не змінюємо useBonuses і не оновлюємо профіль тут; при поверненні на екран useFocusEffect викличе updateBalanceFromAPI і скине вибір бонусів.
        if (saveUserData) {
          const cleanPhone = String(phone).replace(/\D/g, '');
          try {
            await fetch(`${API_URL}/api/user/info/${cleanPhone}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name,
                city: shippingCity,
                warehouse: isNovaPoshta ? shippingWarehouse : undefined,
                user_ukrposhta: isNovaPoshta ? undefined : shippingWarehouse,
                email,
                contact_preference: contactMethod
              })
            });
          } catch (e) {
            // Ignore sync errors (order is already created)
          }
        }

        const paymentUrl = getPaymentUrl(result?.payment_url ?? result?.pageUrl);
        if (paymentUrl && paymentMethod === 'card') {
          try {
            await Linking.openURL(paymentUrl);
          } catch (e) {
            // Якщо посилання не відкрилося, все одно продовжуємо оформлення
          }
        }

        clearCart();
        logFirebaseEvent('purchase', {
          currency: 'UAH',
          value: Math.floor(finalPriceWithBonuses),
          transaction_id: String(result?.order_id ?? ''),
          items: (items ?? []).map((i: any) => ({
            item_id: String(i.id),
            item_name: i.name,
            price: i.price,
            quantity: i.quantity
          }))
        });

        Alert.alert(
          String(`Замовлення #${result?.order_id ?? ''} прийнято! 🎉`),
          String(`Дякуємо!\nМи зв'яжемося з Вами для підтвердження.`),
          [{ text: 'Чудово!', onPress: () => router.replace('/(tabs)/profile') }]
        );
      } else {
        // Помилка сервера/платіжного шлюзу — скидаємо використання бонусів і оновлюємо баланс
        setUseBonuses(false);
        const storedPhone = await AsyncStorage.getItem('userPhone').catch(() => null);
        if (storedPhone) fetchUserInfo(storedPhone);
        Alert.alert('Помилка сервера', toAlertMessage(result?.detail ?? result?.error ?? 'Щось пішло не так'));
      }
    } catch (error) {
      console.error(error);
      setUseBonuses(false);
      const storedPhone = await AsyncStorage.getItem('userPhone').catch(() => null);
      if (storedPhone) fetchUserInfo(storedPhone);
      const errorMessage = (error as any)?.response?.data?.detail ?? (error as Error)?.message ?? (error as any)?.detail ?? 'Произошла ошибка';
      Alert.alert('Ошибка', toAlertMessage(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  // Використовуємо finalPrice з контексту для відображення
  const bonusesToUse = useBonuses ? Math.min(bonusesFromProfile ?? 0, finalPrice ?? 0) : 0;
  const finalPriceWithBonuses = Math.max(0, (finalPrice ?? 0) - bonusesToUse);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.headerTitle}>Оформлення замовлення</Text>

          {/* ✅ 1. СПИСОК ТОВАРОВ (ORDER SUMMARY) */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ваше замовлення</Text>
            {items && items.length > 0 ? items.map((item: any, index: number) => {
              const imageUrl = item.image
                ? (item.image.startsWith('http')
                    ? item.image
                    : `${API_URL}${item.image.startsWith('/') ? '' : '/'}${item.image}`)
                : null;
              return (
                <View key={`${item.id}_${index}`} style={styles.orderItemRow}>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.orderItemImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.orderItemImage, styles.orderItemImagePlaceholder]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemVariant}>
                      {item?.label ?? item?.weight ?? 'Стандарт'}
                      {item.quantity > 1 ? ` x ${item.quantity} шт` : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>
                    {item.price * item.quantity} ₴
                  </Text>
                </View>
              );
            }) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Контакти</Text>
            <TextInput style={styles.input} placeholder="Ваше Ім'я" placeholderTextColor="#666" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Телефон (для доставки)" placeholderTextColor="#666" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            {/* ✅ 2. EMAIL (OPTIONAL) */}
            <TextInput
                style={styles.input}
                placeholder="Email (не обов&apos;язково)"
              placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            {/* ✅ 3. СПОСОБ СВЯЗИ (CONTACT PREFERENCE) */}
            <Text style={styles.subLabel}>Зручний спосіб зв&apos;язку:</Text>
            <View style={styles.methodContainer}>
                <TouchableOpacity
                    style={[styles.methodChip, contactMethod === 'call' && styles.methodChipActive]}
                    onPress={() => setContactMethod('call')}
                >
                    <Text style={[styles.methodText, contactMethod === 'call' && styles.methodTextActive]}>📞 Дзвінок</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.methodChip, contactMethod === 'telegram' && styles.methodChipActive]}
                    onPress={() => setContactMethod('telegram')}
                >
                    <Text style={[styles.methodText, contactMethod === 'telegram' && styles.methodTextActive]}>✈️ Telegram</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.methodChip, contactMethod === 'viber' && styles.methodChipActive]}
                    onPress={() => setContactMethod('viber')}
                >
                    <Text style={[styles.methodText, contactMethod === 'viber' && styles.methodTextActive]}>💬 Viber</Text>
                </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Доставка</Text>

            <View style={styles.deliveryRow}>
              <TouchableOpacity
                style={[styles.deliveryOption, deliveryMethod === 'nova_poshta' && styles.deliveryOptionActive]}
                onPress={() => setDeliveryMethod('nova_poshta')}
              >
                <Text style={[styles.deliveryText, deliveryMethod === 'nova_poshta' && styles.deliveryTextActive]}>
                  Нова Пошта
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deliveryOption, deliveryMethod === 'ukrposhta' && styles.deliveryOptionActive]}
                onPress={() => setDeliveryMethod('ukrposhta')}
              >
                <Text style={[styles.deliveryText, deliveryMethod === 'ukrposhta' && styles.deliveryTextActive]}>
                  Укрпошта
                </Text>
              </TouchableOpacity>
            </View>

            {deliveryMethod === 'nova_poshta' ? (
              <>
                <TouchableOpacity style={styles.selectBtn} onPress={() => openModal('city')}>
                  <Text style={city.name ? styles.selectBtnTextActive : styles.selectBtnText}>
                    {city.name || "Оберіть місто..."}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.selectBtn} onPress={() => openModal('warehouse')}>
                  <Text style={warehouse.name ? styles.selectBtnTextActive : styles.selectBtnText}>
                    {warehouse.name || "Оберіть відділення..."}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Місто / Село / СМТ"
                  placeholderTextColor="#666"
                  value={ukrCity}
                  onChangeText={setUkrCity}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Поштовий індекс"
                  placeholderTextColor="#666"
                  value={ukrIndex}
                  onChangeText={setUkrIndex}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Адреса відділення або вулиця"
                  placeholderTextColor="#666"
                  value={ukrAddress}
                  onChangeText={setUkrAddress}
                  multiline
                />
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Оплата</Text>
            <View style={styles.paymentRow}>
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionActive]}
                onPress={() => setPaymentMethod('card')}
              >
                <Ionicons name="card-outline" size={24} color={paymentMethod === 'card' ? '#FFF' : '#333'} />
                <Text style={[styles.paymentText, paymentMethod === 'card' && { color: '#FFF' }]}>
                  Google Pay (Картка)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionActive]}
                onPress={() => setPaymentMethod('cash')}
              >
                <Ionicons name="cash-outline" size={24} color={paymentMethod === 'cash' ? '#FFF' : '#333'} />
                <Text style={[styles.paymentText, paymentMethod === 'cash' && { color: '#FFF' }]}>
                  Оплата при отриманні
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bonusCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.bonusIconBg}>
                <Ionicons name="gift" size={20} color="#FFD700" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.bonusTitle}>Використати бонуси</Text>
                {profileLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <ActivityIndicator size="small" color="#FFD700" />
                    <Text style={[styles.bonusSubtitle, { marginLeft: 8 }]}>Завантаження...</Text>
                  </View>
                ) : (
                  <Text style={styles.bonusSubtitle}>На рахунку: {bonusesFromProfile} ₴</Text>
                )}
              </View>
            </View>
            <Switch
              value={useBonuses}
              onValueChange={setUseBonuses}
              trackColor={{ false: "#767577", true: Colors.light.tint }}
              disabled={profileLoading || bonusesFromProfile <= 0}
            />
          </View>

          <TouchableOpacity style={styles.saveDataRow} onPress={() => setSaveUserData(!saveUserData)}>
            <View style={[styles.checkbox, saveUserData && styles.checkboxActive]}>
              {saveUserData && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </View>
            <Text style={styles.saveDataText}>Зберегти дані для наступних замовлень</Text>
          </TouchableOpacity>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Вартість товарів:</Text>
              <Text style={styles.summaryValue}>{totalPrice ?? 0} ₴</Text>
            </View>
            {(finalPrice ?? 0) < (totalPrice ?? 0) && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#FF6B35' }]}>Знижка промокодом:</Text>
                <Text style={[styles.summaryValue, { color: '#FF6B35' }]}>-{Math.round((totalPrice ?? 0) - (finalPrice ?? 0))} ₴</Text>
              </View>
            )}
            {useBonuses && bonusesToUse > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#4CAF50' }]}>Знижка бонусами:</Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>-{bonusesToUse} ₴</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>До сплати:</Text>
              <Text style={styles.totalValue}>{Math.round(finalPriceWithBonuses)} ₴</Text>
            </View>
          </View>

          {paymentMethod === 'card' && !isBranchSelected && (
            <Text style={styles.warningText}>Оберіть відділення доставки перед оплатою карткою.</Text>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (!isBranchSelected || loading) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || !isBranchSelected}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>ПІДТВЕРДИТИ ЗАМОВЛЕННЯ</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalVisible !== null} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalVisible === 'city' ? "Пошук міста" : "Оберіть відділення"}</Text>
            <TouchableOpacity onPress={() => setModalVisible(null)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {modalVisible === 'city' && (
            <TextInput
              style={styles.modalInput}
              placeholder="Введіть назву міста..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={searchCity}
              autoFocus={true}
            />
          )}

          {loadingSearch ? (
            <ActivityIndicator style={{ marginTop: 20 }} size="large" />
          ) : (
            <>
              {modalVisible === 'city' && searchQuery === '' && (
                <>
                  <Text style={styles.popularCitiesTitle}>Популярні міста</Text>
                  {popularCities.map((item) => (
                    <TouchableOpacity
                      key={item.ref}
                      style={styles.resultItem}
                      onPress={() => handleSelectCity(item)}
                    >
                      <Text style={styles.resultText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {(modalVisible !== 'city' || searchQuery !== '') && (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item, index) => `${item.ref}-${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
                      <Text style={styles.resultText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 15, paddingBottom: 50 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 20, color: '#333', textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  input: { borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 10, backgroundColor: '#FAFAFA' },
  selectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 15, marginBottom: 10, backgroundColor: '#FAFAFA' },
  selectBtnText: { color: '#999', fontSize: 16 },
  selectBtnTextActive: { color: '#333', fontSize: 16 },
  deliveryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  deliveryOption: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', alignItems: 'center', backgroundColor: '#FAFAFA' },
  deliveryOptionActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  deliveryText: { fontWeight: '600', color: '#333' },
  deliveryTextActive: { color: '#FFF' },
  paymentRow: { flexDirection: 'row', gap: 10 },
  paymentOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', gap: 8 },
  paymentOptionActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  paymentText: { fontWeight: '600', color: '#333' },
  bonusCard: { backgroundColor: '#333', borderRadius: 12, padding: 15, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bonusIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  bonusTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  bonusSubtitle: { color: '#FFD700', fontSize: 13 },
  saveDataRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.light.tint, marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  checkboxActive: { backgroundColor: Colors.light.tint },
  saveDataText: { fontSize: 14, color: '#555' },
  summaryContainer: { marginVertical: 10, paddingHorizontal: 5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 16, color: '#666' },
  summaryValue: { fontSize: 16, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#DDD', marginVertical: 10 },
  totalLabel: { fontSize: 20, fontWeight: 'bold' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: Colors.light.tint },
  submitBtn: { backgroundColor: Colors.light.tint, borderRadius: 12, paddingVertical: 18, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  submitBtnDisabled: { backgroundColor: '#AAA', opacity: 0.8 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  warningText: { fontSize: 14, color: '#E65100', marginTop: 8, marginBottom: 4, paddingHorizontal: 5 },
  modalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalInput: { margin: 15, padding: 15, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, fontSize: 16, backgroundColor: '#F9F9F9' },
  popularCitiesTitle: { fontSize: 14, fontWeight: '600', color: '#666', marginHorizontal: 20, marginTop: 8, marginBottom: 12 },
  resultItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  resultText: { fontSize: 16, color: '#333' },

  // ✅ New Styles Added below
  orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', paddingBottom: 8 },
  orderItemImage: { width: 48, height: 48, borderRadius: 8, marginRight: 10 },
  orderItemImagePlaceholder: { backgroundColor: '#EEE' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 2 },
  itemVariant: { fontSize: 13, color: '#888' },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  subLabel: { fontSize: 14, color: '#666', marginBottom: 8, marginTop: 10 },
  methodContainer: { flexDirection: 'row', gap: 8 },
  methodChip: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F0F0F0', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  methodChipActive: { backgroundColor: '#E8F5E9', borderColor: Colors.light.tint },
  methodText: { fontSize: 12, color: '#333', fontWeight: '500' },
  methodTextActive: { color: '#2E7D32', fontWeight: 'bold' },
});
