import React, { useState, useEffect } from 'react';
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
import { useForm, Controller } from 'react-hook-form';
import { Theme } from '../../theme';
import { ProfileService } from '../../services/ProfileService';
import { ValidationRules } from '../../constants/validationRules';
import { TextInput, PrimaryButton, LoadingOverlay } from '../../common';

// Validation handled by react-hook-form

const getInitials = (fullName = '') =>
  fullName
    .split(' ')
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('');

const EditProfileScreen = ({ navigation }) => {
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  const { control, handleSubmit, formState: { errors }, reset, watch } = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
    mode: 'onBlur',
  });

  const nameValue = watch('name');
  const emailValue = watch('email');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await ProfileService.getProfile();
        if (profile) {
          reset({
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            address: profile.address,
          });
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    };
    fetchProfile();
  }, [reset]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      await ProfileService.updateProfile(data);
      Alert.alert('Success', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(nameValue || 'User');

  return (
    <View style={styles.container}>
      <LoadingOverlay isVisible={saving} message="Saving..." />

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
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            </View>
            <Text style={styles.heroName}>
              {nameValue || 'Your Name'}
            </Text>
            <Text style={styles.heroEmail}>{emailValue}</Text>
          </View>

          {/* 2. Floating Form Card */}
          <View style={styles.formCard}>
            <Controller
              control={control}
              name="name"
              rules={ValidationRules.name}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Full Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.name?.message}
                  placeholder="Enter your full name"
                  autoCapitalize="words"
                  returnKeyType="next"
                  style={styles.premiumInput}
                />
              )}
            />

            <View style={styles.inputSpacer} />

            <Controller
              control={control}
              name="email"
              render={({ field: { value } }) => (
                <View>
                  <TextInput
                    label="Email Address"
                    value={value}
                    editable={false}
                    placeholder="Email address"
                    style={[styles.premiumInput, styles.readOnlyInput]}
                  />
                  <Text style={styles.readOnlyHint}>Email cannot be changed.</Text>
                </View>
              )}
            />

            <View style={styles.inputSpacer} />

            <Controller
              control={control}
              name="phone"
              rules={{ required: 'Phone number is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Phone Number"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  style={styles.premiumInput}
                />
              )}
            />

            <View style={styles.inputSpacer} />

            <Controller
              control={control}
              name="address"
              rules={{ required: 'Address is required' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Delivery Address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.address?.message}
                  placeholder="Enter your delivery address"
                  returnKeyType="done"
                  style={styles.premiumInput}
                />
              )}
            />
          </View>

          {/* 3. Bottom CTA Button */}
          <PrimaryButton
            title="Save Changes"
            onPress={handleSubmit(onSubmit)}
            isLoading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default EditProfileScreen;

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
  avatarOuter: {
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
  avatarInner: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    ...Theme.typography.h1,
    color: Theme.colors.surface.light,
  },
  heroName: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroEmail: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
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
  readOnlyInput: {
    backgroundColor: Theme.colors.background.light,
    opacity: 0.6,
  },
  readOnlyHint: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    marginTop: -4,
  },
  inputSpacer: {
    height: Theme.spacing.l,
  },

  saveBtn: {
    height: 56,
    borderRadius: Theme.radius.pill,
    justifyContent: 'center',
    ...Theme.shadows.medium,
  },
});
