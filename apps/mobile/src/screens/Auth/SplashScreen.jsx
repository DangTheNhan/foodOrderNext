import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import packageJson from '../../../package.json';

export const SplashScreen = ({ navigation }) => {
  const hydrate = useAuthStore(state => state.hydrate);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [fallbackMessage, setFallbackMessage] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Smooth fade in for branding UX
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const bootstrapAsync = async () => {
      const { token, hasSeenOnboarding, isTimeout } = await hydrate();

      const proceedToApp = () => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (token) {
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          } else if (!hasSeenOnboarding) {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'Auth',
                  state: {
                    index: 0,
                    routes: [{ name: 'Onboarding' }],
                  },
                },
              ],
            });
          } else {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'Auth',
                  state: {
                    index: 0,
                    routes: [{ name: 'Login' }],
                  },
                },
              ],
            });
          }
        });
      };

      if (isTimeout) {
        setFallbackMessage('Preparing your experience...');
        setTimeout(proceedToApp, 1500);
      } else {
        setTimeout(proceedToApp, 1000);
      }
    };

    bootstrapAsync();
  }, [hydrate, navigation, fadeAnim]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, Theme.spacing.l),
          paddingBottom: Math.max(insets.bottom, Theme.spacing.l),
        },
      ]}
    >
      <Animated.View style={[styles.brandContainer, { opacity: fadeAnim }]}>
        <View style={styles.heroSection}>
          <View style={styles.logoPlaceholder}>
            <Icon name="restaurant" size={64} color={Theme.colors.primary} />
          </View>
          <Text style={styles.brandName}>FoodApp</Text>
          <Text style={styles.subtitle}>Premium Food Delivery</Text>
        </View>

        <View style={styles.loadingSection}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          {fallbackMessage && (
            <Text style={styles.fallbackText}>{fallbackMessage}</Text>
          )}
        </View>
      </Animated.View>

      <Text style={styles.versionText}>v{packageJson.version}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl,
  },
  logoPlaceholder: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
    borderWidth: 4,
    borderColor: Theme.colors.surface.light,
    ...Theme.shadows.large,
  },
  brandName: {
    ...Theme.typography.h1,
    fontWeight: '800',
    color: Theme.colors.text.primaryLight,
    marginBottom: Theme.spacing.s,
    textAlign: 'center',
  },
  subtitle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },
  loadingSection: {
    alignItems: 'center',
    height: 60, // Fixed height to prevent jump when fallback message appears
  },
  fallbackText: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginTop: Theme.spacing.m,
    textAlign: 'center',
  },
  versionText: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
  },
});
