import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const BackButton = ({ onPress }) => (
  <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8} accessibilityLabel="Go back">
    <Text style={styles.icon}>←</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: { width: 48, height: 48, justifyContent: 'center', alignItems: 'flex-start', position: 'absolute', left: 0, zIndex: 10 },
  icon: { fontSize: 24, color: Theme.colors.text.primaryLight, fontWeight: '700' }
});