import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { TextInput, PasswordInput, PrimaryButton } from '../../common';
import { LoadingOverlay } from '../../common/molecules/LoadingOverlay';
import { FormError, PasswordStrengthIndicator } from '../../components/auth';
import { ValidationRules } from '../../constants/validationRules';
import { AuthRoutes } from '../../constants/authRoutes';
import { AuthService } from '../../services/AuthService';
import { usePasswordVisibility } from '../../hooks/usePasswordVisibility';

export const RegisterScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const insets = useSafeAreaInsets();
  
  const { isSecure: isPasswordSecure, toggleVisibility: togglePasswordVisibility } = usePasswordVisibility();
  const { isSecure: isConfirmSecure, toggleVisibility: toggleConfirmVisibility } = usePasswordVisibility();

  const { control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const currentPassword = watch('password');

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      setApiError(null);
      
      await AuthService.register(data.name, data.email, data.password);
      
      navigation.navigate(AuthRoutes.EMAIL_VERIFICATION, { email: data.email, purpose: 'register' });
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Failed to create account';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => navigation.goBack();

  return (
    <View style={styles.container}>
      {/* Floating Back Button (no shadow, top of hierarchy) */}
      <TouchableOpacity 
        style={[styles.backBtn, { top: Math.max(insets.top, Theme.spacing.l) }]} 
        onPress={handleGoBack}
        activeOpacity={0.8}
      >
        <Icon name="arrow-back" size={24} color={Theme.colors.text.primaryLight} />
      </TouchableOpacity>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, Theme.spacing.l) + 60, // accommodate back button
              paddingBottom: insets.bottom + Theme.spacing.xl,
            }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Premium Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.iconWrapper}>
              <Icon name="person-add" size={48} color={Theme.colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroSubtitle}>Join thousands of happy food lovers.</Text>
          </View>

          {/* 2. Form Card */}
          <View style={styles.formCard}>
            {apiError && <FormError error={apiError} />}

            <Controller
              control={control}
              name="name"
              rules={ValidationRules.name}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputGroup}>
                  <TextInput
                    placeholder="Full Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    style={styles.inputField}
                  />
                  {errors.name && <FormError error={errors.name.message} />}
                </View>
              )}
            />

            <Controller
              control={control}
              name="email"
              rules={ValidationRules.email}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputGroup}>
                  <TextInput
                    placeholder="Email Address"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    style={styles.inputField}
                  />
                  {errors.email && <FormError error={errors.email.message} />}
                </View>
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={ValidationRules.password}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputGroup}>
                  <PasswordInput
                    placeholder="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    isSecure={isPasswordSecure}
                    onToggleVisibility={togglePasswordVisibility}
                    style={styles.inputField}
                  />
                  <PasswordStrengthIndicator password={value} />
                  {errors.password && <FormError error={errors.password.message} />}
                </View>
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: 'Confirm Password is required',
                validate: (value) => value === currentPassword || 'Passwords do not match'
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputGroup}>
                  <PasswordInput
                    placeholder="Confirm Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    isSecure={isConfirmSecure}
                    onToggleVisibility={toggleConfirmVisibility}
                    style={styles.inputField}
                  />
                  {errors.confirmPassword && <FormError error={errors.confirmPassword.message} />}
                </View>
              )}
            />

            <PrimaryButton 
              title="Sign Up" 
              onPress={handleSubmit(onSubmit)} 
              disabled={isLoading}
              style={styles.primaryBtn}
            />
          </View>

          {/* 3. Secondary Actions */}
          <View style={styles.secondarySection}>
            <Text style={styles.secondaryText}>Already have an account?</Text>
            <TouchableOpacity onPress={handleGoBack} activeOpacity={0.7}>
              <Text style={styles.secondaryAction}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <LoadingOverlay isVisible={isLoading} message="Creating account..." />
      </KeyboardAvoidingView>
    </View>
  );
};

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
    flexGrow: 1,
    justifyContent: 'center',
  },
  
  // Floating Back Button
  backBtn: {
    position: 'absolute',
    left: Theme.spacing.l,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...Theme.shadows.light,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
    borderWidth: 4,
    borderColor: Theme.colors.surface.light,
    ...Theme.shadows.large,
  },
  heroTitle: {
    ...Theme.typography.h1,
    fontWeight: '800',
    color: Theme.colors.text.primaryLight,
    marginBottom: Theme.spacing.s,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },

  // Form Card
  formCard: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    ...Theme.shadows.medium,
  },
  inputGroup: {
    marginBottom: Theme.spacing.l,
  },
  inputField: {
    height: 56,
    borderRadius: Theme.radius.large,
  },
  primaryBtn: {
    height: 56,
    borderRadius: Theme.radius.pill,
    marginTop: Theme.spacing.l,
    ...Theme.shadows.medium,
  },

  // Secondary
  secondarySection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Theme.spacing.xxl,
  },
  secondaryText: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    marginRight: Theme.spacing.s,
  },
  secondaryAction: {
    ...Theme.typography.body1,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
});
