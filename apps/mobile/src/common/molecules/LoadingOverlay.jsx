import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme';

export const LoadingOverlay = ({ isVisible, message }) => {
  return (
    <Modal transparent visible={isVisible} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.spinner} />
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Slightly darker for premium feel
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: Theme.colors.surface.light,
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.xxl,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    ...Theme.shadows.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  spinner: {
    transform: [{ scale: 1.2 }], // Make it slightly larger
    marginBottom: Theme.spacing.m,
  },
  message: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    textAlign: 'center',
  },
});
