import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const CategoryChip = ({ label, isActive, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.activeContainer]}
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Text style={[styles.label, isActive && styles.activeLabel]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.surface.light,
    marginRight: Theme.spacing.m,
    ...Theme.shadows.light,
  },
  activeContainer: {
    backgroundColor: Theme.colors.primary,
  },
  label: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    fontWeight: '600',
  },
  activeLabel: {
    color: Theme.colors.surface.light,
    fontWeight: '600',
  },
});
