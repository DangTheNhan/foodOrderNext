import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const PriceTag = ({ price, originalPrice, currency = '$', style, textStyle }) => {
  return (
    <View style={[styles.container, style]}>
      {originalPrice && (
        <Text style={[styles.originalPrice, textStyle]}>
          {currency}{originalPrice.toFixed(2)}
        </Text>
      )}
      <Text style={[styles.currency, textStyle]}>{currency}</Text>
      <Text style={[styles.price, textStyle]}>{price.toFixed(2)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    ...Theme.typography.body2,
    fontWeight: '700',
    color: Theme.colors.primary,
    marginRight: 2,
  },
  price: {
    ...Theme.typography.h3,
    fontWeight: '700',
    color: Theme.colors.text.primaryLight,
  },
  originalPrice: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
});
