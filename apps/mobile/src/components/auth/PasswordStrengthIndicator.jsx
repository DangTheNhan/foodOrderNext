import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const PasswordStrengthIndicator = ({ password = '' }) => {
  const getStrength = () => {
    if (password.length === 0) return { score: 0, text: '', color: Theme.colors.border };
    if (password.length < 6) return { score: 1, text: 'Weak', color: Theme.colors.feedback.error };
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) return { score: 3, text: 'Strong', color: Theme.colors.feedback.success };
    return { score: 2, text: 'Fair', color: Theme.colors.feedback.warning };
  };

  const strength = getStrength();
  if (strength.score === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {[1, 2, 3].map((step) => (
          <View key={step} style={[styles.bar, { backgroundColor: strength.score >= step ? strength.color : Theme.colors.border }]} />
        ))}
      </View>
      <Text style={[styles.text, { color: strength.color }]}>{strength.text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Theme.spacing.m },
  bars: { flexDirection: 'row', gap: 4, flex: 1, marginRight: Theme.spacing.m },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  text: { ...Theme.typography.caption, fontWeight: '700', width: 45, textAlign: 'right' }
});