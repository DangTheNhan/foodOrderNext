import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Theme } from '../../theme';

export const OutlinedButton = ({
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
        <Text style={[styles.title, isDisabled && styles.disabledText, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.transparent,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    height: 56,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: {
    borderColor: Theme.colors.text.secondary,
    opacity: 0.6,
  },
  title: {
    ...Theme.typography.body1,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  disabledText: {
    color: Theme.colors.text.secondary,
  },
});
