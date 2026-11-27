import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Theme } from '../../theme';

export const SecondaryButton = ({
  title,
  onPress,
  isLoading = false,
  isDisabled = false,
  style,
  textStyle,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled || isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color={Theme.colors.primary} />
      ) : (
        <Text style={[styles.title, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.transparent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: {
    opacity: 0.5,
  },
  title: {
    ...Theme.typography.button,
    fontWeight: '600',
    color: Theme.colors.primary,
  },
});
