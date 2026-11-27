import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { Theme } from '../../theme';

export const AuthLayout = ({ children, style }) => (
  <SafeAreaView style={styles.safeArea}>
    <View style={[styles.container, style]}>
      {children}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.background.light },
  container: { flex: 1, paddingHorizontal: Theme.spacing.xl }
});