import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ProductInfoProps {
  content: string;
  type?: 'description' | 'usage' | 'composition' | 'delivery' | 'return';
}

/**
 * Компонент для красивого отображения информации о товаре
 * Поддерживает автоматическое форматирование текста со структурой
 */
export default function ProductInfo({ content, type = 'description' }: ProductInfoProps) {
  if (!content || content.trim() === '') {
    // Показываем дефолтные тексты для обязательных полей
    const defaultContent = getDefaultContent(type);
    if (defaultContent) {
      return (
        <View style={styles.container}>
          <Text style={styles.text}>{defaultContent}</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyState}>
        <Ionicons name="information-circle-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>Інформація відсутня</Text>
      </View>
    );
  }

  // Парсим контент на секции
  const sections = parseContent(content);

  return (
    <View style={styles.container}>
      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          {section.title && (
            <View style={styles.titleRow}>
              {section.icon && (
                <Ionicons name={section.icon as any} size={20} color="#2E7D32" style={styles.titleIcon} />
              )}
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          
          {section.items && section.items.length > 0 ? (
            // Список с иконками
            <View style={styles.list}>
              {section.items.map((item, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" style={styles.bullet} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : (
            // Обычный текст
            <Text style={styles.text}>{section.text}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

interface ContentSection {
  title?: string;
  icon?: string;
  text?: string;
  items?: string[];
}

/**
 * Парсит текст в структурированный формат
 * Поддерживает:
 * - Заголовки: **Заголовок:**
 * - Списки: - пункт или • пункт
 * - Абзацы
 */
function parseContent(content: string): ContentSection[] {
  const sections: ContentSection[] = [];
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  let currentSection: ContentSection = {};
  
  for (const line of lines) {
    // Проверяем на заголовок: **Заголовок:** или ### Заголовок
    if (line.match(/^\*\*(.+?)[:：]\*\*/) || line.match(/^#{1,3}\s+(.+)/)) {
      // Сохраняем предыдущую секцию
      if (currentSection.title || currentSection.text || currentSection.items) {
        sections.push(currentSection);
      }
      
      const title = line.replace(/^\*\*/, '').replace(/\*\*$/, '')
        .replace(/[:：]$/, '').replace(/^#{1,3}\s+/, '').trim();
      
      currentSection = {
        title,
        icon: getIconForTitle(title),
        items: []
      };
      continue;
    }
    
    // Проверяем на пункт списка: - пункт, • пункт, ✓ пункт
    if (line.match(/^[-•✓✔●]\s+/)) {
      const item = line.replace(/^[-•✓✔●]\s+/, '').trim();
      if (!currentSection.items) {
        currentSection.items = [];
      }
      currentSection.items.push(item);
      continue;
    }
    
    // Обычный текст
    if (currentSection.items && currentSection.items.length > 0) {
      // Если уже есть элементы списка, начинаем новую секцию
      sections.push(currentSection);
      currentSection = { text: line };
    } else {
      currentSection.text = currentSection.text 
        ? `${currentSection.text}\n\n${line}` 
        : line;
    }
  }
  
  // Добавляем последнюю секцию
  if (currentSection.title || currentSection.text || currentSection.items) {
    sections.push(currentSection);
  }
  
  // Если нет секций, создаем одну с весь текстом
  if (sections.length === 0) {
    sections.push({ text: content });
  }
  
  return sections;
}

/**
 * Подбирает иконку на основе заголовка
 */
function getIconForTitle(title: string): string | undefined {
  const lower = title.toLowerCase();
  
  if (lower.includes('склад') || lower.includes('состав')) return 'flask';
  if (lower.includes('властивост') || lower.includes('свойств')) return 'star';
  if (lower.includes('застосування') || lower.includes('применение') || lower.includes('використання')) return 'medical';
  if (lower.includes('корист') || lower.includes('польз')) return 'heart';
  if (lower.includes('дозування') || lower.includes('дозировка')) return 'water';
  if (lower.includes('зберігання') || lower.includes('хранен')) return 'snow';
  if (lower.includes('протипоказан') || lower.includes('противопоказан')) return 'alert-circle';
  if (lower.includes('доставка') || lower.includes('доставк')) return 'car';
  if (lower.includes('повернення') || lower.includes('возврат')) return 'return-up-back';
  if (lower.includes('якість') || lower.includes('качеств')) return 'shield-checkmark';
  
  return undefined;
}

/**
 * Возвращает дефолтный текст для разных типов контента
 */
function getDefaultContent(type: string): string | undefined {
  switch (type) {
    case 'delivery':
      return 'Безкоштовна доставка:\n- Новою поштою від 1500 грн\n- Укрпоштою від 1000 грн\n\nВідправка:\nПосилки відправляються щодня після 19:00 (у суботу та неділю після 18:00)\n\nІнші перевізники:\nЗа домовленістю\n\nОплата:\n- Банківський переказ (Приватбанк/Монобанк)\n- Готівкою кур\'єром\n- Післяплата при отриманні (за наш рахунок)\n- Інші способи за запитом\n\nМінімальна сума замовлення: 200 грн';
    case 'return':
      return 'Умови повернення:\nМи дуже стежимо за якістю товарів. Якщо щось не сподобається, у вас є 14 днів для ознайомлення і ще 14 днів на пересилку в обидва боки. Загалом 28 днів з дня замовлення.\n\nВимоги:\n- Товар має бути в оригінальній упаковці\n- Послуги пересилання оплачує покупець\n\nНаша відповідальність:\nЯкщо при відправці ми допустили помилку/неточність/брак, усі виправлення відбуваються за наш рахунок.';
    default:
      return undefined;
  }
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  section: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
  },
  list: {
    gap: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    marginRight: 10,
    marginTop: 2,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#999',
  },
});
