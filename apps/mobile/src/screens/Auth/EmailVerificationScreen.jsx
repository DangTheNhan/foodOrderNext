import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, TextInput as RNTextInput, Text } from 'react-native';
import { Theme } from '../../theme';
import { PrimaryButton, OutlinedButton } from '../../common';
import { LoadingOverlay } from '../../common/molecules/LoadingOverlay';
import {
  AuthLayout,
  KeyboardAvoidingWrapper,
  AuthHeader,
  AuthTitle,
  AuthSubtitle,
  FormError
} from '../../components/auth';
import { AuthRoutes } from '../../constants/authRoutes';
import { AuthConstants } from '../../constants/authConstants';
import { AuthService } from '../../services/AuthService';
import { useCountdownTimer } from '../../hooks/useCountdownTimer';

const CODE_LENGTH = AuthConstants.OTP_LENGTH;

export const EmailVerificationScreen = ({ navigation, route }) => {
  const { email, purpose } = route.params;

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));

  const inputRefs = useRef([]);
  const { seconds, isActive, resetTimer } = useCountdownTimer(AuthConstants.RESEND_CODE_TIMEOUT_SECONDS);

  // Handle individual digit input with auto-focus advance
  const handleCodeChange = useCallback((text, index) => {
    // Accept only single digits
    if (text && !/^\d$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    setApiError(null);

    // Auto-advance to the next input on entry
    if (text && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [code]);

  // Handle backspace to move focus to the previous input
  const handleKeyPress = useCallback((e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  }, [code]);

  const handleVerify = async () => {
    const verificationCode = code.join('');

    if (verificationCode.length !== CODE_LENGTH) {
      setApiError(`Please enter the full ${CODE_LENGTH}-digit code`);
      return;
    }

    try {
      setIsLoading(true);
      setApiError(null);

      const response = await AuthService.verifyEmail(email, verificationCode);

      // Account verified, go to Login
      navigation.navigate(AuthRoutes.LOGIN);
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Invalid verification code';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setIsLoading(true);
      setApiError(null);

      // Re-send the verification email
      await AuthService.register(email, email, '');

      resetTimer();
    } catch (error) {
      setApiError(error.message || 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => navigation.goBack();

  // Format countdown as MM:SS
  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <AuthLayout>
      <AuthHeader onBackPress={handleGoBack} />

      <KeyboardAvoidingWrapper>
        <AuthTitle title="Email Verification" />
        <AuthSubtitle subtitle={`We sent a verification code to\n${email}`} />

        <View style={styles.codeContainer} accessibilityLabel="Verification code input">
          {code.map((digit, index) => (
            <RNTextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.codeInput,
                digit ? styles.codeInputFilled : null,
                apiError ? styles.codeInputError : null,
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              accessibilityLabel={`Digit ${index + 1} of ${CODE_LENGTH}`}
            />
          ))}
        </View>

        {apiError && <FormError error={apiError} />}

        <View style={styles.timerContainer}>
          {isActive ? (
            <Text style={styles.timerText}>Resend code in {formattedTime}</Text>
          ) : (
            <Text style={styles.timerText}>Didn't receive the code?</Text>
          )}
        </View>

        <PrimaryButton
          title="Verify"
          onPress={handleVerify}
          disabled={isLoading || code.join('').length !== CODE_LENGTH}
          style={styles.verifyButton}
        />

        <OutlinedButton
          title="Resend Code"
          onPress={handleResend}
          disabled={isActive || isLoading}
          style={styles.resendButton}
        />
      </KeyboardAvoidingWrapper>

      <LoadingOverlay isVisible={isLoading} message="Verifying..." />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.m,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: Theme.radius.standard,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    textAlign: 'center',

    fontWeight: '700',
    color: Theme.colors.text.primaryLight,
    backgroundColor: Theme.colors.surface.light,
  },
  codeInputFilled: {
    borderColor: Theme.colors.primary,
  },
  codeInputError: {
    borderColor: Theme.colors.feedback.error,
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: Theme.spacing.l,
  },
  timerText: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
  },
  verifyButton: {
    marginBottom: Theme.spacing.m,
  },
  resendButton: {
    marginBottom: Theme.spacing.l,
  },
});
