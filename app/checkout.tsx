import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logFirebaseEvent } from '@/utils/firebaseAnalytics';
import { useRouter } from 'expo-router';
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
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '../config/api';
import { useCart } from '../context/CartContext';

// 🔥 ВАШ КЛЮЧ НОВОЙ ПОЧТЫ 🔥
const NP_API_KEY = "363f7b7ab1240146ccfc1d6163e60301";

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart() as any; 

  // Поля формы (ваш код без изменений)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [city, setCity] = useState({ ref: '', name: '' }); 
  const [warehouse, setWarehouse] = useState({ ref: '', name: '' }); 
  const [modalVisible, setModalVisible] = useState<'city' | 'warehouse' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [bonusBalance, setBonusBalance] = useState(0);
  const [useBonuses, setUseBonuses] = useState(false);
  const [saveUserData, setSaveUserData] = useState(false);

  // Ваш код загрузки данных (без изменений)
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const storedPhone = await AsyncStorage.getItem('userPhone');
      if (storedPhone) {
        setPhone(storedPhone);
        setAccountPhone(storedPhone);
        fetchUserBonuses(storedPhone);
      }

      const savedInfo = await AsyncStorage.getItem('savedCheckoutInfo');
      if (savedInfo) {
        const parsed = JSON.parse(savedInfo);
        if (parsed.name) setName(parsed.name);
        if (parsed.city) setCity(parsed.city);
        if (parsed.warehouse) setWarehouse(parsed.warehouse);
        setSaveUserData(true);
      }
    } catch (e) { console.log(e); }
  };

  const fetchUserBonuses = async (phoneNumber: string) => {
    try {
      const res = await fetch(`${API_URL}/user/${phoneNumber}`);
      if (res.ok) {
        const data = await res.json();
        setBonusBalance(data.bonus_balance || 0);
      }
    } catch (e) { console.log(e); }
  };

  // --- НОВАЯ ПОЧТА --- (ваш код без изменений)
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
    } catch (e) { console.log(e); } finally { setLoadingSearch(false); }
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

  // ✅ Отправка заказа на бэкенд (бэкенд сам синхронизирует с OneBox)
  const handleSubmit = async () => {
    if (!name || !phone || !city.name || !warehouse.name) {
      Alert.alert('Увага', 'Будь ласка, заповніть всі поля:\n• Ім\'я\n• Телефон\n• Місто та Відділення');
      return;
    }

    setLoading(true);

    // Сохранение данных пользователя
    if (saveUserData) {
        await AsyncStorage.setItem('savedCheckoutInfo', JSON.stringify({ name, city, warehouse }));
    } else {
        await AsyncStorage.removeItem('savedCheckoutInfo');
    }

    try {
      // Подготовка данных для отправки на бэкенд
      const cleanItems = (items || []).map((item: any) => ({
        id: Number(item.id),
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        packSize: item.packSize || null,
        unit: item.unit || 'шт',
        variant_info: null
      }));

      const bonusesToUse = useBonuses ? Math.min(bonusBalance, totalPrice) : 0;
      const finalPrice = Math.max(0, totalPrice - bonusesToUse);

      const orderData = {
        name, 
        user_phone: accountPhone,
        phone: phone,
        city: city.name, cityRef: city.ref || "",
        warehouse: warehouse.name, warehouseRef: warehouse.ref || "",
        items: cleanItems,
        totalPrice: Math.floor(finalPrice),
        payment_method: paymentMethod,
        bonus_used: bonusesToUse,
        use_bonuses: useBonuses
      };

      console.log('� Отправка заказа на бэкенд:', orderData);

      const response = await fetch(`${API_URL}/create_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      // Проверяем тип ответа перед парсингом
      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Если сервер вернул не JSON (например, HTML или текст)
        const textResponse = await response.text();
        console.error('Сервер вернул не JSON:', textResponse);
        throw new Error(`Сервер повернув некоректну відповідь: ${textResponse.substring(0, 100)}`);
      }

      if (response.ok) {
        clearCart();
        
        // Firebase Analytics: Purchase
        logFirebaseEvent('purchase', {
            currency: 'UAH',
            value: Math.floor(finalPrice),
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
      console.error('Ошибка оформления:', error);
      Alert.alert('Помилка', error instanceof Error ? error.message : 'Не вдалося створити замовлення. Спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  // Остальной код JSX без изменений...
  const bonusesToUse = useBonuses ? Math.min(bonusBalance, totalPrice) : 0;
  const finalPrice = Math.max(0, totalPrice - bonusesToUse);

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#F5F5F5'}}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Весь ваш JSX остается БЕЗ ИЗМЕНЕНИЙ */}
          <Text style={styles.headerTitle}>Оформлення замовлення</Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Контакти</Text>
            <TextInput style={styles.input} placeholder="Ваше Ім'я" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Телефон (для доставки)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>

          {/* ... весь остальной JSX такой же ... */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Доставка (Нова Пошта)</Text>
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
          </View>

          {/* Коротко: весь остальной JSX остается тем же */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Оплата</Text>
            <View style={styles.paymentRow}>
              <TouchableOpacity 
                style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionActive]} 
                onPress={() => setPaymentMethod('card')}
              >
                <Ionicons name="card-outline" size={24} color={paymentMethod === 'card' ? '#FFF' : '#333'} />
                <Text style={[styles.paymentText, paymentMethod === 'card' && {color: '#FFF'}]}>Картою</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionActive]} 
                onPress={() => setPaymentMethod('cash')}
              >
                <Ionicons name="cash-outline" size={24} color={paymentMethod === 'cash' ? '#FFF' : '#333'} />
                <Text style={[styles.paymentText, paymentMethod === 'cash' && {color: '#FFF'}]}>При отриманні</Text>
              </TouchableOpacity>
            </View>
          </View>

          {bonusBalance > 0 && (
            <View style={styles.bonusCard}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={styles.bonusIconBg}>
                  <Ionicons name="gift" size={20} color="#FFD700" />
                </View>
                <View style={{marginLeft: 10}}>
                  <Text style={styles.bonusTitle}>Використати бонуси</Text>
                  <Text style={styles.bonusSubtitle}>На рахунку: {bonusBalance} ₴</Text>
                </View>
              </View>
              <Switch 
                value={useBonuses} onValueChange={setUseBonuses} 
                trackColor={{ false: "#767577", true: "#4CAF50" }}
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
            {useBonuses && bonusesToUse > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, {color: '#4CAF50'}]}>Знижка бонусами:</Text>
                <Text style={[styles.summaryValue, {color: '#4CAF50'}]}>-{bonusesToUse} ₴</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>До сплати:</Text>
              <Text style={styles.totalValue}>{finalPrice} ₴</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>ПІДТВЕРДИТИ ЗАМОВЛЕННЯ</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Модалка НП - без изменений */}
      <Modal visible={modalVisible !== null} animationType="slide">
         <SafeAreaView style={{flex: 1}}>
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
              <ActivityIndicator style={{marginTop: 20}} size="large" />
          ) : (
              <FlatList 
                  data={searchResults}
                  keyExtractor={(item, index) => `${item.ref}-${index}`} 
                  renderItem={({item}) => (
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

// Styles остаются БЕЗ ИЗМЕНЕНИЙ
const styles = StyleSheet.create({
  scrollContent: { padding: 15, paddingBottom: 50 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, marginTop: 20, color: '#333', textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  input: { borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 10, backgroundColor: '#FAFAFA' },
  selectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 15, marginBottom: 10, backgroundColor: '#FAFAFA' },
  selectBtnText: { color: '#999', fontSize: 16 },
  selectBtnTextActive: { color: '#333', fontSize: 16 },
  paymentRow: { flexDirection: 'row', gap: 10 },
  paymentOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', gap: 8 },
  paymentOptionActive: { backgroundColor: '#333', borderColor: '#333' },
  paymentText: { fontWeight: '600', color: '#333' },
  bonusCard: { backgroundColor: '#333', borderRadius: 12, padding: 15, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bonusIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  bonusTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  bonusSubtitle: { color: '#FFD700', fontSize: 13 },
  saveDataRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#4CAF50', marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  checkboxActive: { backgroundColor: '#4CAF50' },
  saveDataText: { fontSize: 14, color: '#555' },
  summaryContainer: { marginVertical: 10, paddingHorizontal: 5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 16, color: '#666' },
  summaryValue: { fontSize: 16, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#DDD', marginVertical: 10 },
  totalLabel: { fontSize: 20, fontWeight: 'bold' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50' },
  submitBtn: { backgroundColor: '#000', borderRadius: 12, paddingVertical: 18, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  modalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalInput: { margin: 15, padding: 15, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, fontSize: 16, backgroundColor: '#F9F9F9' },
  resultItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  resultText: { fontSize: 16, color: '#333' }
});
