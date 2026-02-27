import { FloatingChatButton } from '@/components/FloatingChatButton';
import { API_URL } from '@/config/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
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

// --- ТИПЫ ---
interface UserProfile {
  phone: string;
  bonus_balance: number;
  total_spent: number;
  cashback_percent: number;
  name?: string;
  city?: string;
  warehouse?: string;
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
  const [infoEmail, setInfoEmail] = useState('');
  const [infoContactPreference, setInfoContactPreference] = useState<'call' | 'telegram' | 'viber'>('call');
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Reviews State
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);


  // 1. Проверка авторизации и обновление данных при фокусе
  useFocusEffect(
    useCallback(() => {
      checkLogin();
    }, [])
  );

  const checkLogin = async () => {
    const storedPhone = await AsyncStorage.getItem('userPhone');
    if (storedPhone) {
      setPhone(storedPhone);
      fetchData(storedPhone);
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
    try {
      const resUser = await fetch(`${API_URL}/user/${phoneNumber}`);
      if (resUser.ok) {
        const user = await resUser.json();
        setProfile(user);
        // Локальные фолбэки для автозаполнения и вкладки «Інформація»
        if (user?.name) await AsyncStorage.setItem('userName', String(user.name));
        if (user?.email) await AsyncStorage.setItem('userEmail', String(user.email));
        if (user?.contact_preference && ['call', 'telegram', 'viber'].includes(user.contact_preference)) {
          await AsyncStorage.setItem('userContactPreference', String(user.contact_preference));
        }
        if (user?.city) await AsyncStorage.setItem('userCity', String(user.city));
        if (user?.warehouse) await AsyncStorage.setItem('userWarehouse', String(user.warehouse));
      }

      // Sanitized phone for orders
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const resOrders = await fetch(`${API_URL}/api/client/orders/${cleanPhone}`);
      if (resOrders.ok) setOrders(await resOrders.json());
      
      // Load reviews
      fetchUserReviews(cleanPhone);
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
          await AsyncStorage.removeItem('userPhone');
          await AsyncStorage.removeItem('userName');
          setPhone('');
          setProfile(null);
          setOrders([]);
          setInputPhone('');
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

    // Fallback на локально сохранённые данные (guest checkout с галочкой "зберегти дані")
    let localName = '';
    let localCity = '';
    let localWarehouse = '';
    let localEmail = '';
    let localContact: 'call' | 'telegram' | 'viber' | '' = '';
    try {
      const saved = await AsyncStorage.getItem('savedCheckoutInfo');
      if (saved) {
        const parsed = JSON.parse(saved);
        localName = String(parsed?.name || '');
        localEmail = String(parsed?.email || '');
        localCity = String(parsed?.city?.name || parsed?.city || '');
        localWarehouse = String(parsed?.warehouse?.name || parsed?.warehouse || '');
        const cp = parsed?.contact_preference;
        if (cp && ['call', 'telegram', 'viber'].includes(cp)) localContact = cp;
      }

      // Дополнительный fallback на отдельные ключи (на случай старого savedCheckoutInfo)
      if (!localEmail) {
        localEmail = String((await AsyncStorage.getItem('userEmail')) || '');
      }
      if (!localCity) {
        localCity = String((await AsyncStorage.getItem('userCity')) || '');
      }
      if (!localWarehouse) {
        localWarehouse = String((await AsyncStorage.getItem('userWarehouse')) || '');
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
    setInfoCity(profile.city || localCity || '');
    setInfoWarehouse(profile.warehouse || localWarehouse || '');
    setInfoEmail(profile.email || localEmail || '');
    setInfoContactPreference((profile.contact_preference as any) || (localContact as any) || 'call');
    setInfoModalVisible(true);
  };

  const saveUserInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/info/${phone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: infoName,
            city: infoCity,
            warehouse: infoWarehouse,
            email: infoEmail,
            contact_preference: infoContactPreference
        })
      });

      if (res.ok && profile) {
        setProfile({ ...profile, name: infoName, city: infoCity, warehouse: infoWarehouse, email: infoEmail, contact_preference: infoContactPreference });
        await AsyncStorage.setItem('userName', infoName);
        if (infoEmail) await AsyncStorage.setItem('userEmail', infoEmail);
        await AsyncStorage.setItem('userContactPreference', infoContactPreference);
        if (infoCity) await AsyncStorage.setItem('userCity', infoCity);
        if (infoWarehouse) await AsyncStorage.setItem('userWarehouse', infoWarehouse);
        
        // Зберігаємо дані для автозаповнення при оформленні замовлення
        await AsyncStorage.setItem('savedCheckoutInfo', JSON.stringify({
          name: infoName,
          phone,
          email: infoEmail,
          contact_preference: infoContactPreference,
          city: infoCity ? { ref: '', name: infoCity } : { ref: '', name: '' },
          warehouse: infoWarehouse ? { ref: '', name: infoWarehouse } : { ref: '', name: '' }
        }));
        
        setInfoModalVisible(false);
        Alert.alert('Успіх', 'Дані оновлено');
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
    try {
      await Share.share({
        message: `Привіт! Тримай від мене 50 грн на покупки в Dikoros UA! \nВкажи мій номер ${phone} при замовленні.`,
      });
    } catch (error: any) { console.log(error.message); }
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  const showDevAlert = () => {
    Alert.alert('В розробці', 'Цей розділ з\'явиться у наступних оновленнях');
  };

  // === Вспомогательные компоненты ===
  
  const GridBtn = ({ icon, label, onPress, color = Colors.light.tint }: any) => (
    <TouchableOpacity style={styles.gridItem} onPress={onPress}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={styles.gridText}>{label}</Text>
    </TouchableOpacity>
  );

  const MenuItem = ({ label, isLast = false, onPress }: any) => (
    <View>
      <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <Text style={styles.menuItemText}>{label}</Text>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </View>
  );

  const MenuSection = ({ title, children }: any) => (
    <View style={styles.menuSection}>
      {title && <Text style={styles.sectionHeader}>{title}</Text>}
      <View style={styles.menuList}>
        {children}
      </View>
    </View>
  );

  // === ОБЩИЙ КОНТЕНТ ===
  const renderCommonMenu = () => (
    <>
      {/* СЕТКА БЫСТРЫХ ДЕЙСТВИЙ */}
      <View style={styles.gridContainer}>
        <GridBtn icon="receipt-outline" label="Замовлення" onPress={() => router.push('/(tabs)/orders')} />
        <GridBtn icon="chatbubble-ellipses-outline" label="Підтримка" onPress={() => openLink('https://t.me/dikoros_support')} />
        <GridBtn icon="heart-outline" label="Мої списки" onPress={showDevAlert} />
        <GridBtn icon="mail-outline" label="Повідомлення" onPress={() => {}} />
        <GridBtn icon="person-outline" label="Інформація" onPress={openInfoModal} />
        <GridBtn icon="globe-outline" label="UA | UAH" onPress={() => {}} />
      </View>

      {/* СПИСКИ МЕНЮ */}
      <MenuSection title="Бонуси та знижки">
        <MenuItem label="Мої винагороди" onPress={showDevAlert} />
        <MenuItem label="Бонуси на покупки" onPress={showDevAlert} />
        <MenuItem label="Знижки та акції" isLast onPress={showDevAlert} />
      </MenuSection>

      <MenuSection title="Моя активність">
        <MenuItem label="Моя сторінка" onPress={showDevAlert} />
        <MenuItem label="Мої відгуки" isLast onPress={() => setReviewsModalVisible(true)} />
      </MenuSection>

      <MenuSection title="Налаштування">
        <MenuItem label="Налаштування сповіщень" onPress={showDevAlert} />
        <MenuItem label="Керування пристроями" isLast onPress={showDevAlert} />
      </MenuSection>

      <MenuSection title="Інформація">
        <MenuItem label="Доставка" onPress={showDevAlert} />
        <MenuItem label="Блогери" onPress={showDevAlert} />
        <MenuItem label="Партнерська програма" onPress={showDevAlert} />
        <MenuItem label="Рейтинг та відгуки" isLast onPress={showDevAlert} />
      </MenuSection>

      <MenuSection title="Детальніше">
        <MenuItem label="Про Dikoros" onPress={showDevAlert} />
        <MenuItem label="Прес-релізи" onPress={showDevAlert} />
        <MenuItem label="Політика конфіденційності" onPress={showDevAlert} />
        <MenuItem label="Відмова від відповідальності" onPress={showDevAlert} />
        <MenuItem label="Положення та умови" isLast onPress={showDevAlert} />
      </MenuSection>

      {/* 🔥 ВЕРСИЯ УДАЛЕНА ПО ЗАПРОСУ */}
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
        <Text style={styles.welcomeTitle}>Вітаємо в Dikoros!</Text>
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
      {phone ? renderUserView() : renderGuestView()}
      
      <FloatingChatButton bottomOffset={30} />

      {/* МОДАЛКА ВХОДА */}
      <Modal visible={showLoginModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Вхід / Реєстрація</Text>
              <TouchableOpacity onPress={() => setShowLoginModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Введіть номер телефону для входу</Text>
            <TextInput
              style={styles.input}
              placeholder="099 123 45 67"
              value={inputPhone}
              onChangeText={setInputPhone}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>Продовжити</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              <TextInput style={[styles.input, {backgroundColor: '#f5f5f5', color: '#888'}]} value={phone} editable={false} />

              <Text style={{marginBottom: 5, color: '#666'}}>Ім&apos;я та Прізвище</Text>
              <TextInput style={styles.input} value={infoName} onChangeText={setInfoName} placeholder="Іван Іванов" />

              <Text style={{marginBottom: 5, color: '#666'}}>Місто</Text>
              <TextInput style={styles.input} value={infoCity} onChangeText={setInfoCity} placeholder="Київ" />

              <Text style={{marginBottom: 5, color: '#666'}}>Відділення Нової Пошти</Text>
              <TextInput style={styles.input} value={infoWarehouse} onChangeText={setInfoWarehouse} placeholder="Відділення №1" />

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
  menuList: { backgroundColor: '#FFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEE' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  menuItemText: { fontSize: 16, color: '#333' },
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
  modalSubtitle: { color: '#666', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 15, fontSize: 18, marginBottom: 20 },
  loginButton: { backgroundColor: Colors.light.tint, padding: 16, borderRadius: 10, alignItems: 'center' },
  loginButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

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