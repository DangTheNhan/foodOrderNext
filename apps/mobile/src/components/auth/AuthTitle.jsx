import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

export const AuthTitle = ({ title, style }) => (
  <Text style={[styles.title, style]}>{title}</Text>
);

const styles = StyleSheet.create({
  title: { ...Theme.typography.h1, color: Theme.colors.text.primaryLight, marginBottom: Theme.spacing.s }
});