import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';

export const SocialLoginSection = ({ onGooglePress }) => (
  <View style={styles.container}>
    <View style={styles.dividerContainer}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>

    <TouchableOpacity style={styles.googleBtn} onPress={onGooglePress} activeOpacity={0.8}>
      <Icon name="logo-google" size={20} color={Theme.colors.primary} style={styles.googleIcon} />
      <Text style={styles.googleBtnText}>Continue with Google</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: { 
    width: '100%', 
    alignItems: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Theme.spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border,
  },
  dividerText: {
    marginHorizontal: Theme.spacing.m,
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    fontWeight: '500',
  },
  googleBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
    height: 56,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.surface.light,
    ...Theme.shadows.small,
  },
  googleIcon: {
    marginRight: Theme.spacing.m,
  },
  googleBtnText: {
    ...Theme.typography.button,
    fontWeight: '600',
    color: Theme.colors.text.primaryLight,
  }
});