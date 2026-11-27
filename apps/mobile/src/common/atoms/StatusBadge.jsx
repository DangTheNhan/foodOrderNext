import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const StatusBadge = ({ status, label }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return Theme.colors.feedback.success;
      case 'error':
        return Theme.colors.feedback.error;
      case 'warning':
        return Theme.colors.feedback.warning;
      case 'info':
      default:
        return Theme.colors.text.secondary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getStatusColor() + '20' }]}>
      <Text style={[styles.label, { color: getStatusColor() }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.m,
    borderRadius: Theme.radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    ...Theme.typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
