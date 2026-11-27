import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useForm, Controller } from 'react-hook-form';
import { Theme } from '../../theme';
import { ProfileService } from '../../services/ProfileService';
import { ValidationRules } from '../../constants/validationRules';
import { PasswordInput, PrimaryButton, LoadingOverlay } from '../../common';
import { PasswordStrengthIndicator } from '../../components/auth/PasswordStrengthIndicator';
import { useAuthStore } from '../../stores/authStore';
import { resetToLogin } from '../../navigation/navigationRef';

// Validation handled by react-hook-form

const ChangePasswordScreen = ({ navigation }) => {
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  const { control, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  });

  const newPasswordValue = watch('newPassword');

  const onSubmit = async (data) => {
    setSaving(true);

    try {
      const result = await ProfileService.changePassword(
        data.currentPassword,
        data.newPassword,
      );

      if (result.success) {
        Alert.alert('Success', 'Your password has been updated.', [
          { 
            text: 'Log in again', 
            onPress: () => {
              useAuthStore.getState().signOut();
              resetToLogin();
            }
          },
          { 
            text: 'Skip', 
            style: 'cancel',
            onPress: () => navigation.goBack() 
          },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to update password');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred while changing password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay isVisible={saving} message="Updating password..." />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 24),
              paddingBottom: Math.max(insets.bottom, Theme.spacing.l) + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Premium Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroOuterCircle}>
              <View style={styles.heroInnerCircle}>
                <Icon
                  name="lock-closed"
                  size={48}
                  color={Theme.colors.surface.light}
                />
              </View>
            </View>
            <Text style={styles.heroTitle}>Change Password</Text>
            <Text style={styles.heroSubtitle}>
              Your new password must be at least 8 characters long.
            </Text>
          </View>

          {/* 2. Floating Form Card */}
          <View style={styles.formCard}>
            <Controller
              control={control}
              name="currentPassword"
              rules={{ required: 'Current password is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInput
                  label="Current Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.currentPassword?.message}
                  placeholder="Enter current password"
                  returnKeyType="next"
                  style={styles.premiumInput}
                />
              )}
            />

            <View style={styles.inputSpacer} />

            <Controller
              control={control}
              name="newPassword"
              rules={ValidationRules.password}
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInput
                  label="New Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.newPassword?.message}
                  placeholder="Enter new password"
                  returnKeyType="next"
                  style={styles.premiumInput}
                />
              )}
            />

            <View style={styles.indicatorWrapper}>
              <PasswordStrengthIndicator password={newPasswordValue} />
            </View>

            <View style={styles.inputSpacer} />

            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: 'Confirm password is required',
                validate: value => value === newPasswordValue || 'Passwords do not match',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInput
                  label="Confirm New Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                  placeholder="Confirm new password"
                  returnKeyType="done"
                  style={styles.premiumInput}
                />
              )}
            />
          </View>

          {/* 3. Bottom CTA Button */}
          <PrimaryButton
            title="Update Password"
            onPress={handleSubmit(onSubmit)}
            isLoading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ChangePasswordScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.l,
  },

  heroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  heroOuterCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Theme.colors.surface.light,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.l,
    ...Theme.shadows.large,
  },
  heroInnerCircle: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroSubtitle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },

  formCard: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxl,
    ...Theme.shadows.medium,
  },

  premiumInput: {
    minHeight: 56,
    borderRadius: Theme.radius.large,
  },
  inputSpacer: {
    height: Theme.spacing.xl,
  },
  indicatorWrapper: {
    marginTop: Theme.spacing.s,
  },

  saveBtn: {
    height: 56,
    borderRadius: Theme.radius.pill,
    justifyContent: 'center',
    ...Theme.shadows.medium,
  },
});
