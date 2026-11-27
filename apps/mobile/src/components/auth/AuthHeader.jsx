import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Theme } from '../../theme';
import { BackButton } from './BackButton';

export const AuthHeader = ({ showBack = true, onBackPress, style }) => (
  <View style={[styles.container, style]}>
    {showBack && <BackButton onPress={onBackPress} />}
    <View style={styles.logoPlaceholder} />
  </View>
);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginVertical: Theme.spacing.xl, height: 48, position: 'relative' },
  logoPlaceholder: { width: 48, height: 48, borderRadius: Theme.radius.standard, backgroundColor: Theme.colors.primary, marginLeft: 'auto', marginRight: 'auto' }
});