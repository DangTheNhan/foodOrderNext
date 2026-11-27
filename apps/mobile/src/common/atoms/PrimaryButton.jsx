import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Theme } from '../../theme';

export const PrimaryButton = ({
  title,
  onPress,
  isLoading = false,
  isDisabled = false,
  disabled = false,       // alias used by some screens
  style,
  textStyle,
}) => {
  const _disabled = isDisabled || disabled;
  return (
    <TouchableOpacity
      style={[
        styles.container,
        _disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={_disabled || isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color={Theme.colors.surface.light} />
      ) : (
        <Text style={[styles.title, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.primary,
    height: 56,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Theme.shadows.medium,
  },
  disabled: {
    backgroundColor: Theme.colors.text.secondary,
    opacity: 0.6,
  },
  title: {
    ...Theme.typography.body1,
    fontWeight: '700',
    color: Theme.colors.surface.light,
  },
});
