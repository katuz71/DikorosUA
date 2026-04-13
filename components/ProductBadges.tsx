import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const getProductBadges = (product: any) => {
  if (!product) return [];
  const badges = [];
  
  // Понимает true, 1, "1", "Да", "Так", "yes", "+"
  const isTrue = (val: any) => {
    if (val === undefined || val === null) return false;
    const s = String(val).toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'да' || s === 'так' || s === 'yes' || s === '+';
  };

  // 1. Знижка / Акція (проверяем old_price или флаг is_promotion)
  const price = Number(product.price) || 0;
  const oldPrice = Number(product.old_price || product.oldPrice || product.price_old) || 0;
  if ((oldPrice > price && price > 0)) {
    const percent = Math.round(((oldPrice - price) / oldPrice) * 100);
    badges.push({ id: 'discount', text: `-${percent}%`, bg: '#EF4444' });
  } else if (isTrue(product.is_promotion)) {
    badges.push({ id: 'discount', text: 'Акція', bg: '#EF4444' });
  }

  // 2. Хіт (проверяем is_hit, is_bestseller)
  if (isTrue(product.is_hit) || isTrue(product.is_bestseller) || isTrue(product.hit)) {
    badges.push({ id: 'hit', text: 'Хіт', bg: '#F59E0B' });
  }

  // 3. Новинка (проверяем is_new)
  if (isTrue(product.is_new) || isTrue(product.new)) {
    badges.push({ id: 'new', text: 'Новинка', bg: '#3B82F6' });
  }

  return badges;
};

interface ProductBadgesProps {
  product: any;
  containerStyle?: any;
}

export const ProductBadges = ({ product, containerStyle }: ProductBadgesProps) => {
  const badges = getProductBadges(product);
  if (badges.length === 0) return null;

  return (
    <View style={[styles.container, containerStyle]}>
      {badges.map((b) => (
        <View key={b.id} style={[styles.badge, { backgroundColor: b.bg }]}>
          <Text style={styles.text}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    gap: 4,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
