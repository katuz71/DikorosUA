import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { useCart } from './context/CartContext';
import { useOrders, OrderItem } from './context/OrdersContext';

// Используем фиксированный IP адрес
const getApiBase = () => {
  return 'http://192.168.1.161:8000';
};

const API_BASE = getApiBase();

interface City {
  Ref: string;
  Description: string;
}

interface Warehouse {
  Ref: string;
  Description: string;
  Number?: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const { addOrder } = useOrders();
  const [successVisible, setSuccessVisible] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash');
  
  const [cities, setCities] = useState<City[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Фильтрация отделений по поисковому запросу
  const filteredWarehouses = warehouses.filter((warehouse) => {
    if (!warehouseSearch.trim()) {
      return true; // Показываем все, если поиск пустой
    }
    
    const searchLower = warehouseSearch.toLowerCase().trim();
    const description = warehouse.Description?.toLowerCase() || '';
    const number = warehouse.Number?.toLowerCase() || '';
    
    // Если поиск состоит только из цифр, ищем по номеру
    if (/^\d+$/.test(warehouseSearch.trim())) {
      return number.includes(searchLower) || number === searchLower;
    }
    
    // Иначе ищем и по названию, и по номеру
    return description.includes(searchLower) || number.includes(searchLower);
  });

  // Загрузка городов при вводе
  useEffect(() => {
    if (citySearch.length >= 2) {
      const timeoutId = setTimeout(() => {
        fetchCities(citySearch);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setCities([]);
      setShowCityDropdown(false);
    }
  }, [citySearch]);

  // Проверка доступности сервера перед запросом
  const checkServerHealth = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд для проверки
      
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  };

  const fetchCities = async (search: string) => {
    if (!search || search.length < 2) {
      setCities([]);
      setShowCityDropdown(false);
      return;
    }
    
    setLoadingCities(true);
    try {
      // Сначала проверяем доступность сервера
      const serverAvailable = await checkServerHealth();
      if (!serverAvailable) {
        throw new Error('Server is not available');
      }
      
      const url = `${API_BASE}/get_cities?search=${encodeURIComponent(search)}`;
      console.log('Fetching cities from:', url);
      console.log('Platform:', Platform.OS);
      console.log('API_BASE:', API_BASE);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 секунд timeout
      
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      const endTime = Date.now();
      console.log(`Request took ${endTime - startTime}ms`);
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Cities response:', data);
      
      if (data && data.success && data.data && Array.isArray(data.data)) {
        setCities(data.data);
        setShowCityDropdown(true);
      } else {
        console.warn('Invalid response format:', data);
        setCities([]);
        setShowCityDropdown(false);
      }
    } catch (error: any) {
      console.error('Error fetching cities:', error);
      if (error.name === 'AbortError') {
        console.error('Request timeout - сервер не отвечает или API Nova Poshta медленно отвечает');
        Alert.alert(
          'Таймаут запиту',
          'Сервер не відповідає протягом 30 секунд. Можливо:\n1. API Nova Poshta працює повільно\n2. Проблеми з інтернетом\n3. Спробуйте пізніше'
        );
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        console.error('Network error - check if server is running and accessible');
        Alert.alert(
          'Помилка підключення',
          `Не вдалося підключитися до сервера.\n\nПеревірте:\n1. Сервер запущений на ${API_BASE}\n2. Пристрій і комп'ютер в одній мережі\n3. Фаєрвол не блокує з'єднання`
        );
      }
      setCities([]);
      setShowCityDropdown(false);
    } finally {
      setLoadingCities(false);
    }
  };

  // Загрузка складов при выборе города
  useEffect(() => {
    if (selectedCity && selectedCity.Ref) {
      console.log('City selected, fetching warehouses for:', selectedCity.Ref);
      fetchWarehouses(selectedCity.Ref);
      setWarehouseSearch('');
      setSelectedWarehouse(null);
    } else {
      setWarehouses([]);
      setSelectedWarehouse(null);
      setWarehouseSearch('');
      setShowWarehouseDropdown(false);
    }
  }, [selectedCity]);

  const fetchWarehouses = async (cityRef: string) => {
    if (!cityRef) {
      setWarehouses([]);
      return;
    }
    
    setLoadingWarehouses(true);
    try {
      const url = `${API_BASE}/get_warehouses?city_ref=${encodeURIComponent(cityRef)}`;
      console.log('Fetching warehouses from:', url);
      console.log('CityRef:', cityRef);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 секунд timeout
      
      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      const endTime = Date.now();
      console.log(`Warehouses request took ${endTime - startTime}ms`);
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Warehouses response:', JSON.stringify(data, null, 2));
      
      // Проверяем различные форматы ответа
      if (data && data.success === true && data.data && Array.isArray(data.data)) {
        if (data.data.length > 0) {
          setWarehouses(data.data);
          setShowWarehouseDropdown(true);
        } else {
          console.warn('No warehouses found');
          setWarehouses([]);
          setShowWarehouseDropdown(false);
          Alert.alert('Інформація', 'Не знайдено відділень для вибраного міста');
        }
      } else if (data && data.success === false) {
        const errorMsg = data.errors?.[0] || data.error || 'Невідома помилка';
        console.warn('API returned error:', errorMsg);
        setWarehouses([]);
        setShowWarehouseDropdown(false);
        Alert.alert('Помилка', `Не вдалося завантажити відділення: ${errorMsg}`);
      } else {
        console.warn('Invalid response format:', data);
        setWarehouses([]);
        setShowWarehouseDropdown(false);
      }
    } catch (error: any) {
      console.error('Error fetching warehouses:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      
      let errorMessage = 'Невідома помилка';
      
      if (error.message === 'Server is not available') {
        errorMessage = `Сервер недоступен. Перевірте, що сервер запущений на ${API_BASE}`;
      } else if (error.name === 'AbortError') {
        errorMessage = 'Таймаут запиту. Сервер не відповідає протягом 20 секунд. Спробуйте пізніше.';
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorMessage = `Помилка підключення до сервера.\n\nПеревірте:\n1. Сервер запущений на ${API_BASE}\n2. Пристрій і комп'ютер в одній мережі\n3. Фаєрвол не блокує з'єднання`;
      } else if (error.message) {
        errorMessage = `Помилка: ${error.message}`;
      }
      
      Alert.alert('Помилка завантаження відділень', errorMessage);
      setWarehouses([]);
      setShowWarehouseDropdown(false);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const handleCitySelect = (city: City) => {
    // Немедленно обновляем состояние для лучшей отзывчивости
    setSelectedCity(city);
    setCitySearch(city.Description);
    setShowCityDropdown(false);
    // Сбрасываем выбранное отделение при смене города
    setSelectedWarehouse(null);
    setWarehouseSearch('');
    // Закрываем dropdown отделений при смене города (он откроется после загрузки)
    setShowWarehouseDropdown(false);
  };

  const handleWarehouseSelect = (warehouse: Warehouse) => {
    // Немедленно обновляем состояние для лучшей отзывчивости
    setSelectedWarehouse(warehouse);
    setWarehouseSearch(warehouse.Description || '');
    setShowWarehouseDropdown(false);
  };

  const handleConfirmOrder = async () => {
    // Валидация
    if (!name.trim()) {
      Alert.alert('Помилка', 'Введіть ім\'я');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Помилка', 'Введіть телефон');
      return;
    }
    if (!selectedCity) {
      Alert.alert('Помилка', 'Виберіть місто');
      return;
    }
    if (!selectedWarehouse) {
      Alert.alert('Помилка', 'Виберіть відділення');
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        name,
        phone,
        city: selectedCity.Description,
        cityRef: selectedCity.Ref,
        warehouse: selectedWarehouse.Description,
        warehouseRef: selectedWarehouse.Ref,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          packSize: item.packSize,
        })),
        totalPrice,
        payment_method: paymentMethod,
      };

      const response = await fetch(`${API_BASE}/create_order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const responseData = await response.json();

      if (response.ok && (responseData.success || responseData.status === 'success')) {
        // Если есть checkout_url (онлайн оплата), открываем его
        if (responseData.checkout_url) {
          try {
            await Linking.openURL(responseData.checkout_url);
            // Показываем сообщение о переходе на оплату
            Alert.alert(
              'Перехід на оплату',
              'Ви будете перенаправлені на сторінку оплати. Після успішної оплати замовлення буде підтверджено.',
              [{ text: 'OK' }]
            );
          } catch (error) {
            console.error('Error opening checkout URL:', error);
            Alert.alert('Помилка', 'Не вдалося відкрити посилання для оплати');
          }
        } else if (paymentMethod === 'card') {
          // Если выбран онлайн платеж, но нет checkout_url - показываем ошибку
          Alert.alert(
            'Помилка оплати',
            'Не вдалося отримати посилання для оплати. Будь ласка, спробуйте ще раз або оберіть інший спосіб оплати.',
            [{ text: 'OK' }]
          );
          setSubmitting(false);
          return;
        }

        // Создаем заказ для истории
        const orderItems: OrderItem[] = items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          quantity: item.quantity,
          packSize: item.packSize,
        }));

        const newOrder = {
          id: responseData.order_id?.toString() || Date.now().toString(),
          date: new Date().toLocaleDateString('uk-UA'),
          items: orderItems,
          total: totalPrice,
          city: selectedCity.Description,
          warehouse: selectedWarehouse.Description,
          phone: phone,
          name: name,
        };

        // Добавляем заказ в историю
        addOrder(newOrder);
        
        // Очищаем корзину
        clearCart();
        
        // Показываем модальное окно успеха только если нет checkout_url
        // (если есть checkout_url, пользователь уже на странице оплаты)
        if (!responseData.checkout_url) {
          setSuccessVisible(true);
        }
      } else {
        const errorMessage = responseData.error || 'Не вдалося оформити замовлення';
        console.error('Order creation error:', responseData);
        Alert.alert('Помилка', errorMessage);
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      const errorMessage = error.message || 'Не вдалося підключитися до сервера';
      Alert.alert('Помилка', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.contentWrapper}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
          >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <Text style={styles.title}>Оформлення замовлення</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Form - поднята выше для удобства */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ім'я *</Text>
              <TextInput
                style={styles.input}
                placeholder="Введіть ваше ім'я"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Телефон *</Text>
              <TextInput
                style={styles.input}
                placeholder="+380 XX XXX XX XX"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Місто *</Text>
              <View style={styles.autocompleteContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Введіть назву міста"
                  value={citySearch}
                  onChangeText={(text) => {
                    setCitySearch(text);
                    if (selectedCity && selectedCity.Description !== text) {
                      setSelectedCity(null);
                      setSelectedWarehouse(null);
                      setWarehouseSearch('');
                    }
                  }}
                  onFocus={() => {
                    // Показываем dropdown только если город не выбран
                    if (!selectedCity && cities.length > 0) {
                      setShowCityDropdown(true);
                    }
                  }}
                />
                {loadingCities && (
                  <ActivityIndicator size="small" color="#000" style={styles.loader} />
                )}
              </View>
              {showCityDropdown && cities.length > 0 && !selectedCity && (
                <View style={styles.dropdown}>
                  <ScrollView 
                    nestedScrollEnabled={true} 
                    style={{ maxHeight: 200 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {cities.map((item) => (
                      <TouchableOpacity
                        key={item.Ref}
                        style={styles.dropdownItem}
                        onPress={() => handleCitySelect(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dropdownText}>{item.Description}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {selectedCity && (
              <View style={styles.inputGroup} collapsable={false}>
                <Text style={styles.label}>Відділення *</Text>
                <View style={styles.autocompleteContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Введіть номер (напр. 1) або назву відділення"
                    value={warehouseSearch}
                    onChangeText={(text) => {
                      setWarehouseSearch(text);
                      setShowWarehouseDropdown(true);
                      if (selectedWarehouse && selectedWarehouse.Description !== text) {
                        setSelectedWarehouse(null);
                      }
                    }}
                    onFocus={() => {
                      if (warehouses.length > 0 && !selectedWarehouse) {
                        setShowWarehouseDropdown(true);
                      }
                    }}
                  />
                  {loadingWarehouses ? (
                    <ActivityIndicator size="small" color="#000" style={styles.loader} />
                  ) : selectedWarehouse && warehouseSearch.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => {
                        setSelectedWarehouse(null);
                        setWarehouseSearch('');
                        setShowWarehouseDropdown(true);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
                {showWarehouseDropdown && filteredWarehouses.length > 0 && (
                  <View style={styles.dropdown}>
                    <ScrollView 
                      nestedScrollEnabled={true} 
                      style={{ maxHeight: 250 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredWarehouses.map((item) => (
                        <TouchableOpacity
                          key={item.Ref}
                          style={styles.dropdownItem}
                          onPress={() => handleWarehouseSelect(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dropdownText} numberOfLines={2}>
                            {item.Description}
                            {item.Number && ` (№${item.Number})`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
                {showWarehouseDropdown && warehouseSearch.length > 0 && filteredWarehouses.length === 0 && warehouses.length > 0 && (
                  <View style={styles.dropdown}>
                    <View style={styles.dropdownItem}>
                      <Text style={[styles.dropdownText, { color: '#999' }]}>
                        Нічого не знайдено
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Payment Method Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Спосіб оплати *</Text>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'card' && styles.paymentOptionSelected
                ]}
                onPress={() => setPaymentMethod('card')}
              >
                <View style={styles.paymentOptionContent}>
                  <Ionicons 
                    name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={paymentMethod === 'card' ? '#000' : '#999'} 
                  />
                  <View style={styles.paymentOptionText}>
                    <Text style={[styles.paymentOptionTitle, paymentMethod === 'card' && styles.paymentOptionTitleSelected]}>
                      Оплатити онлайн
                    </Text>
                    <Text style={styles.paymentOptionSubtitle}>
                      Visa/Mastercard, Apple Pay
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'cash' && styles.paymentOptionSelected,
                  { marginTop: 10 }
                ]}
                onPress={() => setPaymentMethod('cash')}
              >
                <View style={styles.paymentOptionContent}>
                  <Ionicons 
                    name={paymentMethod === 'cash' ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={paymentMethod === 'cash' ? '#000' : '#999'} 
                  />
                  <View style={styles.paymentOptionText}>
                    <Text style={[styles.paymentOptionTitle, paymentMethod === 'cash' && styles.paymentOptionTitleSelected]}>
                      Накладений платіж
                    </Text>
                    <Text style={styles.paymentOptionSubtitle}>
                      При отриманні
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Order Summary */}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Ваше замовлення</Text>
              {items.map((item) => (
                <View key={`${item.id}-${item.packSize}`} style={styles.summaryItem}>
                  <Text style={styles.summaryText}>
                    {item.name} ({item.packSize} шт) x {item.quantity}
                  </Text>
                  <Text style={styles.summaryPrice}>
                    {item.price * item.quantity} ₴
                  </Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalText}>Всього:</Text>
                <Text style={styles.totalPrice}>{totalPrice} ₴</Text>
              </View>
            </View>
          </View>
        </ScrollView>
        </View>

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
            onPress={handleConfirmOrder}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.confirmButtonText}>Підтвердити замовлення</Text>
            )}
        </TouchableOpacity>
      </View>
      
      {/* SUCCESS ORDER MODAL */}
      <Modal animationType="fade" transparent={true} visible={successVisible}>
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
            </View>

            <Text style={styles.successModalTitle}>Замовлення прийнято! 🎉</Text>
            <Text style={styles.successModalSubtitle}>
              Дякуємо за довіру.{'\n'}Менеджер зв'яжеться з вами найближчим часом для підтвердження.
            </Text>

            <TouchableOpacity 
              onPress={() => {
                setSuccessVisible(false);
                // Переходим на главный экран и открываем профиль с историей заказов
                router.push('/(tabs)/?showProfile=true');
              }}
              style={styles.successModalButton}
            >
              <Text style={styles.successModalButtonText}>Чудово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 150,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  form: {
    gap: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  autocompleteContainer: {
    position: 'relative',
  },
  loader: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  clearButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    padding: 5,
  },
  selectButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  selectText: {
    fontSize: 16,
    color: '#000',
  },
  placeholder: {
    color: '#999',
  },
  dropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownAbsolute: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 200,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownText: {
    fontSize: 16,
    color: '#000',
  },
  paymentOption: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    backgroundColor: '#fff',
  },
  paymentOptionSelected: {
    borderColor: '#000',
    backgroundColor: '#f9f9f9',
  },
  paymentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentOptionTitleSelected: {
    color: '#000',
    fontWeight: '700',
  },
  paymentOptionSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  summary: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#000',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  confirmButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalContent: {
    backgroundColor: 'white',
    width: '80%',
    padding: 30,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#e8f5e9',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#000',
  },
  successModalSubtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
    fontSize: 14,
  },
  successModalButton: {
    backgroundColor: 'black',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 15,
    width: '100%',
  },
  successModalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
});

