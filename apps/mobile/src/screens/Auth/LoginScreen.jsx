import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { TextInput, PasswordInput, PrimaryButton } from '../../common';
import { LoadingOverlay } from '../../common/molecules/LoadingOverlay';
import { SocialLoginSection, FormError } from '../../components/auth';
import { ValidationRules } from '../../constants/validationRules';
import { AuthRoutes } from '../../constants/authRoutes';
import { AuthService } from '../../services/AuthService';
import { useAuthStore } from '../../stores/authStore';
import { usePasswordVisibility } from '../../hooks/usePasswordVisibility';
import { mockLogin } from '../../mocks/mockAccounts';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../../api/config';

export const LoginScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const insets = useSafeAreaInsets();

  const signIn = useAuthStore(state => state.signIn);
  const { isSecure, toggleVisibility } = usePasswordVisibility();

  React.useEffect(() => {
    if (GoogleSignin && typeof GoogleSignin.configure === 'function') {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
      });
    }
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = async data => {
    try {
      setIsLoading(true);
      setApiError(null);

      // Call actual backend API
      const response = await AuthService.login(data.email, data.password);

      await signIn(response.data.token);
      navigation.reset({ index: 0, routes: [{ name: AuthRoutes.MAIN_STACK }] });
    } catch (error) {
      setApiError(error.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (!GoogleSignin || typeof GoogleSignin.hasPlayServices !== 'function') {
        setApiError('Google Sign-In is not initialized or native module missing. Please rebuild the app (npx react-native run-android).');
        return;
      }
      setIsLoading(true);
      setApiError(null);
      
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      // Use idToken to authenticate with your backend
      const response = await AuthService.loginWithGoogle(userInfo.data.idToken);
      
      await signIn(response.data.token);
      navigation.reset({ index: 0, routes: [{ name: AuthRoutes.MAIN_STACK }] });
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setApiError('Play services not available or outdated');
      } else {
        setApiError(error.message || 'Failed to login with Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterNavigation = () =>
    navigation.navigate(AuthRoutes.REGISTER);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, Theme.spacing.l),
            paddingBottom: insets.bottom + Theme.spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Premium Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.iconWrapper}>
            <Icon name="restaurant" size={48} color={Theme.colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Welcome Back</Text>
          <Text style={styles.heroSubtitle}>
            Sign in to continue ordering your favourite food.
          </Text>
        </View>

        {/* 2. Form Card */}
        <View style={styles.formCard}>
          {apiError && <FormError error={apiError} />}

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
                  isSecure={isSecure}
                  onToggleVisibility={toggleVisibility}
                  style={styles.inputField}
                />
                {errors.password && (
                  <FormError error={errors.password.message} />
                )}
              </View>
            )}
          />


          <PrimaryButton
            title="Log In"
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            style={styles.primaryBtn}
          />
        </View>

        {/* 3. Social & Secondary Actions */}
        <View style={styles.socialSection}>
          <SocialLoginSection
            onGooglePress={handleGoogleLogin}
          />
        </View>

        <View style={styles.secondarySection}>
          <Text style={styles.secondaryText}>Don't have an account?</Text>
          <TouchableOpacity
            onPress={handleRegisterNavigation}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryAction}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LoadingOverlay isVisible={isLoading} message="Signing in..." />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.l,
    flexGrow: 1,
    justifyContent: 'center',
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
    ...Theme.shadows.medium,
  },

  // Social & Secondary
  socialSection: {
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  secondarySection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
