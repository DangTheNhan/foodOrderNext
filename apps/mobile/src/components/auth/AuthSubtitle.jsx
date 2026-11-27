import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const AuthSubtitle = ({ subtitle, style }) => (
  <Text style={[styles.subtitle, style]}>{subtitle}</Text>
);

const styles = StyleSheet.create({
  subtitle: { ...Theme.typography.body1, color: Theme.colors.text.secondary, marginBottom: Theme.spacing.xl }
});