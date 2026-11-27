import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const FormError = ({ error }) => {
  if (!error) return null;
  return <Text style={styles.error}>{error}</Text>;
};

const styles = StyleSheet.create({
  error: { ...Theme.typography.caption, color: Theme.colors.feedback.error, marginTop: -Theme.spacing.s, marginBottom: Theme.spacing.m, marginLeft: Theme.spacing.xs }
});