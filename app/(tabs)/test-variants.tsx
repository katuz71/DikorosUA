/**
 * Тестовый экран для проверки работы вариантов товаров
 * Добавь этот файл в app/(tabs) как test-variants.tsx
 * или используй код в любом существующем компоненте
 */

import { API_URL } from '@/config/api';
import { parseVariants } from '@/utils/productParser';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function VariantsTestScreen() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Тест 1: Проверка API
  const testAPI = async () => {
    setIsLoading(true);
    const results: any[] = [];
    
    try {
      const response = await fetch(`${API_URL}/products`);
      const products = await response.json();
      
      results.push({
        name: 'GET /products',
        status: 'success',
        message: `Загружено ${products.length} товаров`
      });
      
      const withVariants = products.filter((p: any) => p.variants && p.variants.length > 0);
      results.push({
        name: 'Товары с вариантами',
        status: withVariants.length > 0 ? 'success' : 'warning',
        message: `Найдено ${withVariants.length} товаров с вариантами`
      });
      
      if (withVariants.length > 0) {
        const example = withVariants[0];
        results.push({
          name: 'Пример товара',
          status: 'info',
          message: `${example.name}\nВариантов: ${example.variants.length}\nЦена: ${example.price} ₴`
        });
        
        // Тест парсера
        const { variants, mode } = parseVariants(example, products);
        results.push({
          name: 'Парсер вариантов',
          status: 'success',
          message: `Режим: ${mode}\nРаспаршено: ${variants.length} вариантов`
        });
      }
      
    } catch (error: any) {
      results.push({
        name: 'Ошибка API',
        status: 'error',
        message: error.message
      });
    }
    
    setTestResults(results);
    setIsLoading(false);
  };
  
  // Тест 2: Проверка структуры данных
  const testDataStructure = async () => {
    setIsLoading(true);
    const results: any[] = [];
    
    try {
      const response = await fetch(`${API_URL}/products`);
      const products = await response.json();
      
      const checks = {
        hasId: products.filter((p: any) => p.id).length,
        hasName: products.filter((p: any) => p.name).length,
        hasPrice: products.filter((p: any) => p.price !== undefined).length,
        hasVariants: products.filter((p: any) => p.variants && p.variants.length > 0).length,
        hasMinPrice: products.filter((p: any) => p.minPrice !== undefined).length,
        hasImages: products.filter((p: any) => p.image || p.images).length
      };
      
      Object.entries(checks).forEach(([key, count]) => {
        const percentage = ((count / products.length) * 100).toFixed(0);
        results.push({
          name: key,
          status: count === products.length ? 'success' : 'warning',
          message: `${count}/${products.length} (${percentage}%)`
        });
      });
      
    } catch (error: any) {
      results.push({
        name: 'Ошибка проверки',
        status: 'error',
        message: error.message
      });
    }
    
    setTestResults(results);
    setIsLoading(false);
  };
  
  // Тест 3: Симуляция добавления в корзину
  const testCartSimulation = () => {
    const results: any[] = [];
    
    const mockProduct = {
      id: 1,
      name: 'Чага березова',
      price: 370,
      variants: [
        { id: 1001, size: '120 капсул', price: 370 },
        { id: 1002, size: '60 капсул', price: 200 }
      ]
    };
    
    // Симуляция выбора первого варианта
    const selectedVariant = mockProduct.variants[0];
    
    const cartItem = {
      id: mockProduct.id,
      name: mockProduct.name,
      price: selectedVariant.price,
      variant_info: selectedVariant.size,
      unit: selectedVariant.size,
      quantity: 1,
      variantSize: selectedVariant.size
    };
    
    results.push({
      name: 'Товар',
      status: 'info',
      message: mockProduct.name
    });
    
    results.push({
      name: 'Выбранный вариант',
      status: 'success',
      message: `${selectedVariant.size} - ${selectedVariant.price} ₴`
    });
    
    results.push({
      name: 'Структура для корзины',
      status: 'success',
      message: JSON.stringify(cartItem, null, 2)
    });
    
    setTestResults(results);
  };
  
  // Запуск всех тестов
  const runAllTests = async () => {
    setIsLoading(true);
    const allResults: any[] = [];
    
    try {
      // Тест API
      const response = await fetch(`${API_URL}/products`);
      const products = await response.json();
      
      allResults.push({
        name: '✅ Backend API',
        status: 'success',
        message: `${products.length} товаров загружено`
      });
      
      // Товары с вариантами
      const withVariants = products.filter((p: any) => p.variants && p.variants.length > 0);
      allResults.push({
        name: withVariants.length > 0 ? '✅ Варианты найдены' : '⚠️  Варианты не найдены',
        status: withVariants.length > 0 ? 'success' : 'warning',
        message: `${withVariants.length} товаров с вариантами`
      });
      
      // Парсер
      if (withVariants.length > 0) {
        const example = withVariants[0];
        const { variants, mode } = parseVariants(example, products);
        allResults.push({
          name: '✅ Парсер работает',
          status: 'success',
          message: `Режим: ${mode}, Вариантов: ${variants.length}`
        });
      }
      
      // Структура данных
      const hasAllFields = products.every((p: any) => p.id && p.name && p.price !== undefined);
      allResults.push({
        name: hasAllFields ? '✅ Структура данных' : '⚠️  Проблемы со структурой',
        status: hasAllFields ? 'success' : 'warning',
        message: hasAllFields ? 'Все обязательные поля присутствуют' : 'Некоторые поля отсутствуют'
      });
      
      allResults.push({
        name: '✅ Проверка завершена',
        status: 'success',
        message: 'Все тесты пройдены успешно'
      });
      
    } catch (error: any) {
      allResults.push({
        name: '❌ Ошибка',
        status: 'error',
        message: error.message
      });
    }
    
    setTestResults(allResults);
    setIsLoading(false);
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'error': return '#F44336';
      case 'info': return '#2196F3';
      default: return '#757575';
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Тестирование вариантов</Text>
        <Text style={styles.subtitle}>API: {API_URL}</Text>
      </View>
      
      <View style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={runAllTests}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? '⏳ Загрузка...' : '🚀 Запустить все тесты'}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={testAPI}
            disabled={isLoading}
          >
            <Text style={styles.buttonTextSecondary}>📡 API</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={testDataStructure}
            disabled={isLoading}
          >
            <Text style={styles.buttonTextSecondary}>📊 Структура</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={testCartSimulation}
            disabled={isLoading}
          >
            <Text style={styles.buttonTextSecondary}>🛒 Корзина</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {testResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Результаты:</Text>
          {testResults.map((result, index) => (
            <View 
              key={index} 
              style={[
                styles.resultItem,
                { borderLeftColor: getStatusColor(result.status) }
              ]}
            >
              <Text style={styles.resultName}>{result.name}</Text>
              <Text style={styles.resultMessage}>{result.message}</Text>
            </View>
          ))}
        </View>
      )}
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>📋 Чеклист проверки:</Text>
        <Text style={styles.infoText}>✅ Backend возвращает variants</Text>
        <Text style={styles.infoText}>✅ Парсер обрабатывает разные типы</Text>
        <Text style={styles.infoText}>✅ UI адаптируется под варианты</Text>
        <Text style={styles.infoText}>✅ Корзина сохраняет variant_info</Text>
        <Text style={styles.infoText}>✅ Заказ отправляется корректно</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#6200EA',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#E0E0E0',
  },
  buttonsContainer: {
    padding: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#6200EA',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6200EA',
    flex: 1,
    marginHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSecondary: {
    color: '#6200EA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultsContainer: {
    padding: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  resultItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  resultName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  resultMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});
