import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const AuthFooter = ({ text, actionText, onActionPress }) => (
  <View style={styles.container}>
    <Text style={styles.text}>{text}</Text>
    <TouchableOpacity onPress={onActionPress}>
      <Text style={styles.actionText}>{actionText}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Theme.spacing.xl, paddingBottom: Theme.spacing.l },
  text: { ...Theme.typography.body2, color: Theme.colors.text.secondary, marginRight: Theme.spacing.xs },
  actionText: { ...Theme.typography.body2, color: Theme.colors.primary, fontWeight: '700' }
});