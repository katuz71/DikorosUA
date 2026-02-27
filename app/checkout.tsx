import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
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
import { API_URL } from '../config/api';
import { useCart } from '../context/CartContext';
import { Colors } from '../constants/theme';

// 🔥 ВАШ КЛЮЧ НОВОЙ ПОЧТЫ 🔥
const NP_API_KEY = "363f7b7ab1240146ccfc1d6163e60301";

export default function CheckoutScreen() {
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
  const [bonusBalance, setBonusBalance] = useState(0);
  const [useBonuses, setUseBonuses] = useState(false);
  const [saveUserData, setSaveUserData] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

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
        // Fallback: если savedCheckoutInfo отсутствует или был сохранён старой версией
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
        setBonusBalance(data.bonus_balance || 0);
        
        // Автозаповнення email якщо він є на сервері і локальний стейт пустий
        if (data.email && !email) {
          setEmail(data.email);
        }
        
        // Автозаповнення імені якщо воно є на сервері і локальний стейт пустий
        if (data.name && !name) {
          setName(data.name);
        }
        
        // Автозаповнення міста якщо воно є на сервері і локальний стейт пустий
        if (data.city && !city.name) {
          setCity({ ref: '', name: data.city });
        }
        
        // Автозаповнення відділення якщо воно є на сервері і локальний стейт пустий
        if (data.warehouse && !warehouse.name) {
          setWarehouse({ ref: '', name: data.warehouse });
        }
        
        // Автозаповнення способу зв'язку якщо він є на сервері
        if (data.contact_preference && ['call', 'telegram', 'viber'].includes(data.contact_preference)) {
          setContactMethod(data.contact_preference as 'call' | 'telegram' | 'viber');
        }
      }
    } catch (e) { 
      // Ignore error
    }
  };

  // --- НОВАЯ ПОЧТА ---
  const searchCity = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) return;
    setLoadingSearch(true);

    try {
      const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: NP_API_KEY,
          modelName: "Address",
          calledMethod: "searchSettlements",
          methodProperties: { CityName: text, Limit: "50" }
        })
      });
      const data = await response.json();

      if (data.success && data.data && data.data[0] && data.data[0].Addresses) {
        const cities = data.data[0].Addresses.map((item: any) => ({
          ref: item.DeliveryCity,
          name: item.Present
        }));
        setSearchResults(cities);
      } else {
        setSearchResults([]);
      }
    } catch (e) { setSearchResults([]); } finally { setLoadingSearch(false); }
  };

  const loadWarehouses = async () => {
    if (!city.ref) return;
    setLoadingSearch(true);
    setSearchResults([]);

    try {
      const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        body: JSON.stringify({
          apiKey: NP_API_KEY,
          modelName: "Address",
          calledMethod: "getWarehouses",
          methodProperties: { CityRef: city.ref }
        })
      });
      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data)) {
        const warehouses = data.data.map((item: any) => ({
          ref: item.Ref,
          name: item.Description
        }));
        setSearchResults(warehouses);
      }
    } catch (e) { 
      // Ignore error
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
        Alert.alert("Увага", "Спочатку оберіть місто!");
        return;
      }
      loadWarehouses();
    }
  };

  const handleSelect = (item: any) => {
    if (modalVisible === 'city') {
      setCity(item);
      setWarehouse({ ref: '', name: '' });
    } else {
      setWarehouse(item);
    }
    setModalVisible(null);
  };

  const handleSubmit = async () => {
    const isNovaPoshta = deliveryMethod === 'nova_poshta';

    if (
      !name ||
      !phone ||
      (isNovaPoshta
        ? (!city.name || !warehouse.name)
        : (!ukrCity || !ukrIndex || !ukrAddress))
    ) {
      Alert.alert(
        'Увага',
        isNovaPoshta
          ? 'Будь ласка, заповніть всі поля:\n• Ім\'я\n• Телефон\n• Місто та Відділення'
          : 'Будь ласка, заповніть всі поля:\n• Ім\'я\n• Телефон\n• Місто / Село / СМТ\n• Поштовий індекс\n• Адреса доставки'
      );
      return;
    }

    setLoading(true);

    const shippingCity = isNovaPoshta ? city.name : ukrCity;
    const shippingWarehouse = isNovaPoshta
      ? `Нова Пошта: ${warehouse.name}`
      : `Укрпошта: ${ukrIndex}, ${ukrCity}, ${ukrAddress}`;
    const shippingCityRef = isNovaPoshta ? (city.ref || "") : "";
    const shippingWarehouseRef = isNovaPoshta ? (warehouse.ref || "") : "";

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
      if (shippingWarehouse) await AsyncStorage.setItem('userWarehouse', shippingWarehouse);
    } else {
      await AsyncStorage.removeItem('savedCheckoutInfo');
    }

    try {
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
      const bonusesToUse = useBonuses ? Math.min(bonusBalance, finalPrice) : 0;
      const finalPriceWithBonuses = Math.max(0, finalPrice - bonusesToUse);

      const orderData = {
        name,
        user_phone: accountPhone,
        phone: phone,
        email: email || '', // ✅ Include Email
        contact_preference: contactMethod, // ✅ Include Contact Preference
        city: shippingCity, cityRef: shippingCityRef,
        warehouse: shippingWarehouse, warehouseRef: shippingWarehouseRef,
        items: cleanItems,
        totalPrice: Math.floor(finalPriceWithBonuses),
        payment_method: paymentMethod,
        bonus_used: bonusesToUse,
        use_bonuses: useBonuses
      };

      const response = await fetch(`${API_URL}/create_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        // Если включена галочка «зберегти дані», синхронизируем профиль на сервере
        // (на случай если в будущем изменится create_order или payload).
        if (saveUserData) {
          const cleanPhone = String(phone).replace(/\D/g, '');
          try {
            await fetch(`${API_URL}/api/user/info/${cleanPhone}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name,
                city: shippingCity,
                warehouse: shippingWarehouse,
                email,
                contact_preference: contactMethod
              })
            });
          } catch (e) {
            // Ignore sync errors (order is already created)
          }
        }

        const hasPaymentUrl = paymentMethod === 'card' && result && typeof result.payment_url === 'string' && result.payment_url;

        if (hasPaymentUrl) {
          try {
            await WebBrowser.openBrowserAsync(result.payment_url);
          } catch (e) {
            // Якщо браузер не відкрився, все одно продовжуємо оформлення
          }
        }

        clearCart();
        logFirebaseEvent('purchase', {
          currency: 'UAH',
          value: Math.floor(finalPriceWithBonuses),
          transaction_id: String(result.order_id),
          items: items.map((i: any) => ({
            item_id: String(i.id),
            item_name: i.name,
            price: i.price,
            quantity: i.quantity
          }))
        });

        Alert.alert(
          `Замовлення #${result.order_id} прийнято! 🎉`,
          `Дякуємо!\nМи зв'яжемося з Вами для підтвердження.`,
          [{ text: 'Чудово!', onPress: () => router.replace('/(tabs)/profile') }]
        );
      } else {
        Alert.alert('Помилка сервера', result.detail || result.error || 'Щось пішло не так');
      }
    } catch (error) {
      Alert.alert('Помилка', error instanceof Error ? error.message : 'Не вдалося створити замовлення.');
    } finally {
      setLoading(false);
    }
  };

  // Використовуємо finalPrice з контексту для відображення
  const bonusesToUse = useBonuses ? Math.min(bonusBalance, finalPrice) : 0;
  const finalPriceWithBonuses = Math.max(0, finalPrice - bonusesToUse);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.headerTitle}>Оформлення замовлення</Text>

          {/* ✅ 1. СПИСОК ТОВАРОВ (ORDER SUMMARY) */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ваше замовлення</Text>
            {items.map((item: any, index: number) => (
              <View key={`${item.id}_${index}`} style={styles.orderItemRow}>
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
            ))}
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
                  Оплата карткою (MonoPay)
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

          {bonusBalance > 0 && (
            <View style={styles.bonusCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.bonusIconBg}>
                  <Ionicons name="gift" size={20} color="#FFD700" />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.bonusTitle}>Використати бонуси</Text>
                  <Text style={styles.bonusSubtitle}>На рахунку: {bonusBalance} ₴</Text>
                </View>
              </View>
              <Switch
                value={useBonuses} onValueChange={setUseBonuses}
                trackColor={{ false: "#767577", true: Colors.light.tint }}
              />
            </View>
          )}

          <TouchableOpacity style={styles.saveDataRow} onPress={() => setSaveUserData(!saveUserData)}>
            <View style={[styles.checkbox, saveUserData && styles.checkboxActive]}>
              {saveUserData && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </View>
            <Text style={styles.saveDataText}>Зберегти дані для наступних замовлень</Text>
          </TouchableOpacity>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Вартість товарів:</Text>
              <Text style={styles.summaryValue}>{totalPrice} ₴</Text>
            </View>
            {finalPrice < totalPrice && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#FF6B35' }]}>Знижка промокодом:</Text>
                <Text style={[styles.summaryValue, { color: '#FF6B35' }]}>-{Math.round(totalPrice - finalPrice)} ₴</Text>
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

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
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
              placeholder="Введіть назву міста (напр. Київ)"
              value={searchQuery}
              onChangeText={searchCity}
              autoFocus
            />
          )}

          {loadingSearch ? (
            <ActivityIndicator style={{ marginTop: 20 }} size="large" />
          ) : (
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
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  modalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalInput: { margin: 15, padding: 15, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, fontSize: 16, backgroundColor: '#F9F9F9' },
  resultItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  resultText: { fontSize: 16, color: '#333' },

  // ✅ New Styles Added below
  orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', paddingBottom: 8 },
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
