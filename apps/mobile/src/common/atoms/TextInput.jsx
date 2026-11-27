import React, { useState } from 'react';
import { View, TextInput as RNTextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme } from '../../theme';

export const TextInput = ({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focusedBorder,
          error && styles.errorBorder,
          style,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <RNTextInput
          style={styles.input}
          placeholderTextColor={Theme.colors.text.secondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} disabled={!onRightIconPress} style={styles.iconRight}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.l,
  },
  label: {
    ...Theme.typography.body2,
    fontWeight: '600',
    color: Theme.colors.text.primaryLight,
    marginBottom: Theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.large,
    backgroundColor: Theme.colors.surface.light,
    paddingHorizontal: Theme.spacing.m,
    height: 56,
  },
  focusedBorder: {
    borderColor: Theme.colors.primary,
    ...Theme.shadows.light,
  },
  errorBorder: {
    borderColor: Theme.colors.feedback.error,
  },
  input: {
    flex: 1,
    ...Theme.typography.body1,
    color: Theme.colors.text.primaryLight,
  },
  iconLeft: {
    marginRight: Theme.spacing.s,
  },
  iconRight: {
    marginLeft: Theme.spacing.s,
  },
  errorText: {
    ...Theme.typography.caption,
    color: Theme.colors.feedback.error,
    marginTop: Theme.spacing.xs,
  },
});
