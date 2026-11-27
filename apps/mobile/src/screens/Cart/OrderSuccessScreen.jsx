import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { PrimaryButton } from '../../common';


const ESTIMATED_DELIVERY = '25–35 mins';

// ─── Info Row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, highlightValue = false }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconCircle}>
      <Icon name={icon} size={22} color={highlightValue ? Theme.colors.primary : Theme.colors.text.secondary} />
    </View>
    <View style={styles.infoTextContainer}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlightValue && styles.infoValueHighlight]}>
        {value}
      </Text>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const OrderSuccessScreen = ({ navigation, route }) => {
  const orderId = route?.params?.orderId ?? 'ORD-000000';
  const paymentMethod = route?.params?.paymentMethod ?? 'Cash on Delivery';
  const deliveryAddress = route?.params?.deliveryAddress ?? '';
  const insets = useSafeAreaInsets();

  const handleTrackOrder = () => {
    navigation.navigate('TrackOrder', { orderId, paymentMethod, deliveryAddress });
  };

  const handleBackToHome = () => {
    navigation.popToTop();
    navigation.navigate('HomeStack');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 40) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Success Illustration */}
        <View style={styles.heroSection}>
          <View style={styles.iconOuterRings}>
            <View style={styles.iconMiddleRing}>
              <View style={styles.iconInner}>
                <Icon name="checkmark" size={64} color={Theme.colors.surface.light} />
              </View>
            </View>
          </View>
        </View>

        {/* 2. Success Typography */}
        <View style={styles.textSection}>
          <Text style={styles.title}>Order Confirmed</Text>
          <Text style={styles.subtitle}>
            Your order has been placed successfully.{'\n'}
            We'll keep you updated every step of the way.
          </Text>
        </View>

        {/* 3. Order Information Card */}
        <View style={styles.card}>
          <InfoRow
            icon="receipt-outline"
            label="Order ID"
            value={orderId}
          />
          <InfoRow
            icon="time-outline"
            label="Estimated Delivery"
            value={ESTIMATED_DELIVERY}
            highlightValue
          />
          <InfoRow
            icon="wallet-outline"
            label="Payment Method"
            value={paymentMethod}
          />
        </View>
      </ScrollView>

      {/* 4. Bottom Actions */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, Theme.spacing.xxl) }]}>
        <PrimaryButton
          title="Track My Order"
          onPress={handleTrackOrder}
          style={styles.primaryBtn}
        />
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleBackToHome} activeOpacity={0.7}>
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OrderSuccessScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: 40, // padding before the fixed bottom section
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
    marginTop: Theme.spacing.xl,
  },
  iconOuterRings: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Theme.colors.feedback.success + '08',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconMiddleRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Theme.colors.feedback.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Theme.colors.feedback.success,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.large, // Hero effect shadow
  },

  // Text Section
  textSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  title: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    textAlign: 'center',
    marginBottom: Theme.spacing.m,
    fontWeight: '800',
  },
  subtitle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Order Information Card
  card: {
    width: '100%',
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.l,
    ...Theme.shadows.medium,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.m,
  },
  infoIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginBottom: 4,
  },
  infoValue: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  infoValueHighlight: {
    color: Theme.colors.primary,
    fontWeight: '800',
  },

  // Bottom Actions
  bottomSection: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.l,
    backgroundColor: Theme.colors.background.light,
  },
  primaryBtn: {
    borderRadius: Theme.radius.pill,
    height: 56,
    justifyContent: 'center',
    marginBottom: Theme.spacing.l,
    ...Theme.shadows.medium,
  },
  secondaryBtn: {
    height: 56,
    borderRadius: Theme.radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.text.secondary,
    fontWeight: '700',

  },
});
