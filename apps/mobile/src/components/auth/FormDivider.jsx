import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const FormDivider = ({ text = 'OR' }) => (
  <View style={styles.container}>
    <View style={styles.line} />
    <Text style={styles.text}>{text}</Text>
    <View style={styles.line} />
  </View>
);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginVertical: Theme.spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: Theme.colors.border },
  text: { width: 40, textAlign: 'center', ...Theme.typography.caption, color: Theme.colors.text.secondary, fontWeight: '600' }
});