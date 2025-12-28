import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Animated, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// Поднимаемся на уровень выше (..) и заходим в context
import { useCart } from '../context/CartContext';

const products = [
  { id: 1, name: 'Омега-3 Gold', price: 1200, image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80', description: 'Высококачественная Омега-3.' },
  { id: 2, name: 'Витамин C 1000мг', price: 650, image: 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd0?auto=format&fit=crop&w=600&q=80', description: 'Укрепление иммунитета.' },
  { id: 3, name: 'Коллаген Пептидный', price: 2500, image: 'https://images.unsplash.com/photo-1598449356475-b9f71db7d847?auto=format&fit=crop&w=600&q=80', description: 'Для молодости кожи.' },
  { id: 4, name: 'Магний B6', price: 950, image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=600&q=80', description: 'От стресса и усталости.' },
  { id: 5, name: 'Мультивитамины Active', price: 1500, image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80', description: 'Заряд энергии.' },
  { id: 6, name: 'Сывороточный Протеин', price: 3200, image: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=600&q=80', description: 'Рост мышц.' },
];

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const product = products.find(p => p.id.toString() === id);
  
  const [quantity, setQuantity] = useState(1);
  const [selectedPack, setSelectedPack] = useState(30);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Безопасное подключение корзины
  let addItem: ((product: any, packSize: number) => void) | undefined;
  try {
    const cart = useCart();
    addItem = cart.addItem;
  } catch (e) {
    console.log("Cart Error:", e);
  }

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    
    // Анимация появления
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    
    // Автоматическое скрытие через 2 секунды
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToastVisible(false);
      });
    }, 2000);
  };

  const handleAddToCart = () => {
    if (!addItem) {
      Alert.alert("Ошибка", "Корзина не подключена. Перезагрузите приложение.");
      return;
    }
    for (let i = 0; i < quantity; i++) addItem(product, selectedPack);
    showToast('Товар додано в кошик');
  };

  if (!product) return <View><Text>Not found</Text></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Image source={{ uri: product.image }} style={styles.image} />
        
        {/* Кнопка НАЗАД */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="black" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.price}>{product.price} ₴</Text>

          <Text style={styles.sectionTitle}>Фасування (шт)</Text>
          <View style={styles.packRow}>
            {[30, 60, 90, 120].map((num) => (
              <TouchableOpacity key={num} style={[styles.packBtn, selectedPack === num && styles.packBtnActive]} onPress={() => setSelectedPack(num)}>
                <Text style={[styles.packText, selectedPack === num && styles.packTextActive]}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.description}>{product.description}</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.counter}>
          <TouchableOpacity onPress={() => setQuantity(Math.max(1, quantity - 1))}><Ionicons name="remove" size={24} /></TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity onPress={() => setQuantity(quantity + 1)}><Ionicons name="add" size={24} /></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.buyButton} onPress={handleAddToCart}>
          <Text style={styles.buyButtonText}>В корзину • {product.price * quantity} ₴</Text>
        </TouchableOpacity>
      </View>

      {/* TOAST NOTIFICATION */}
      {toastVisible && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 60,
            alignSelf: 'center',
            backgroundColor: 'rgba(30, 30, 30, 0.85)',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 50,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 10,
            zIndex: 10000,
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0]
              })
            }]
          }}
        >
          <Ionicons 
            name="checkmark-circle" 
            size={20} 
            color="white" 
            style={{ marginRight: 10 }}
          />
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
            {toastMessage}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  image: { width: '100%', height: 350 },
  backBtn: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, backgroundColor: 'white', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },
  title: { fontSize: 26, fontWeight: 'bold' },
  price: { fontSize: 24, fontWeight: 'bold', marginVertical: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  packRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  packBtn: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  packBtnActive: { backgroundColor: '#000' },
  packText: { fontSize: 14 },
  packTextActive: { color: '#fff' },
  description: { fontSize: 16, color: '#555' },
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', flexDirection: 'row', gap: 15 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#f5f5f5', padding: 10, borderRadius: 10 },
  qtyText: { fontSize: 18, fontWeight: 'bold' },
  buyButton: { flex: 1, backgroundColor: '#000', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});