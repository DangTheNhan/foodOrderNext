import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { useCartStore } from '../../stores/cartStore';
import { PrimaryButton } from '../../common';
import { ProfileService } from '../../services/ProfileService';
import { DELIVERY_FEE, DISCOUNT_RATE } from '../../constants/cartConstants';
import { PAYMENT_METHODS } from '../../constants/paymentMethods';

// ─── Reusable Checkout Section Header ─────────────────────────────────────────
const SectionHeader = ({ title, actionText, onAction }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {actionText && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
        <Text style={styles.sectionAction}>{actionText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Reusable Summary Row ──────────────────────────────────────────────────────
const SummaryRow = ({ label, value, isTotal = false, isDiscount = false }) => (
  <View style={[styles.summaryRow, isTotal && styles.totalRowMargin]}>
    <Text style={[styles.summaryLabel, isTotal && styles.summaryLabelBold]}>
      {label}
    </Text>
    <Text
      style={[
        styles.summaryValue,
        isTotal && styles.summaryValueBold,
        isDiscount && { color: Theme.colors.feedback.success },
      ]}
    >
      {value}
    </Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const CheckoutScreen = ({ navigation }) => {
  const { cartItems } = useCartStore();
  const insets = useSafeAreaInsets();

  const [customer, setCustomer] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState('Standard');
  const [orderNote, setOrderNote] = useState('');

  // Load customer profile for address
  const loadProfile = async () => {
    try {
      const profile = await ProfileService.getProfile();
      setCustomer(profile);
    } catch (error) {
      console.error('Failed to load profile', error);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadProfile);
    return unsubscribe;
  }, [navigation]);

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.food.price * item.quantity, 0);
  const discount = subtotal * DISCOUNT_RATE;
  const deliveryCost = deliveryMethod === 'Express' ? DELIVERY_FEE + 2.00 : DELIVERY_FEE;
  const total = subtotal + deliveryCost - discount;

  const handlePlaceOrder = () => {
    if (!customer?.address) {
      Alert.alert('Missing Address', 'Please provide a delivery address.');
      return;
    }
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty.');
      return;
    }

    navigation.navigate('Payment', { deliveryMethod, address: customer?.address });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Icon name="arrow-back" size={24} color={Theme.colors.text.primaryLight} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* 2. Delivery Address */}
        <View style={styles.section}>
          <SectionHeader
            title="Delivery Address"
            actionText="Edit"
            onAction={() => navigation.navigate('Profile', { screen: 'EditProfile' })}
          />
          <View style={styles.addressCard}>
            <View style={styles.addressIconContainer}>
              <Icon name="location" size={24} color={Theme.colors.surface.light} />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressName}>{customer?.name || 'Loading...'}</Text>
              <Text style={styles.addressPhone}>{customer?.phone || '+1 234 567 890'}</Text>
              <Text style={styles.addressText}>{customer?.address || 'No address provided'}</Text>
            </View>
          </View>
        </View>

        {/* 3. Delivery Method */}
        <View style={styles.section}>
          <SectionHeader title="Delivery Method" />
          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[styles.methodCard, deliveryMethod === 'Standard' && styles.methodCardActive]}
              onPress={() => setDeliveryMethod('Standard')}
              activeOpacity={0.9}
            >
              <View style={[styles.radioCircle, deliveryMethod === 'Standard' && styles.radioCircleActive]}>
                {deliveryMethod === 'Standard' && <View style={styles.radioInner} />}
              </View>
              <Icon name="bicycle" size={32} color={deliveryMethod === 'Standard' ? Theme.colors.primary : Theme.colors.text.secondary} />
              <Text style={[styles.methodTitle, deliveryMethod === 'Standard' && styles.methodTitleActive]}>Standard</Text>
              <Text style={styles.methodTime}>20-30 min</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodCard, deliveryMethod === 'Express' && styles.methodCardActive]}
              onPress={() => setDeliveryMethod('Express')}
              activeOpacity={0.9}
            >
              <View style={[styles.radioCircle, deliveryMethod === 'Express' && styles.radioCircleActive]}>
                {deliveryMethod === 'Express' && <View style={styles.radioInner} />}
              </View>
              <Icon name="flash" size={32} color={deliveryMethod === 'Express' ? Theme.colors.primary : Theme.colors.text.secondary} />
              <Text style={[styles.methodTitle, deliveryMethod === 'Express' && styles.methodTitleActive]}>Express</Text>
              <Text style={styles.methodTime}>10-15 min</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Order Note */}
        <View style={styles.section}>
          <SectionHeader title="Order Note" />
          <View style={styles.noteContainer}>
            <RNTextInput
              style={styles.noteInput}
              placeholder="E.g. No onions, extra spicy..."
              placeholderTextColor={Theme.colors.text.secondary}
              multiline
              numberOfLines={3}
              value={orderNote}
              onChangeText={setOrderNote}
            />
          </View>
        </View>

        {/* 6. Payment Preview */}
        <View style={styles.section}>
          <SectionHeader title="Payment Method" />
          <View style={styles.card}>
            {PAYMENT_METHODS.map((method, index) => (
              <View key={method.id} style={[styles.paymentRow, index > 0 && { marginTop: Theme.spacing.l }]}>
                <View style={styles.paymentIconBox}>
                  <Icon name={method.icon} size={24} color={Theme.colors.text.primaryLight} />
                </View>
                <Text style={styles.paymentText}>{method.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 7. Order Summary */}
        <View style={styles.section}>
          <SectionHeader title="Order Summary" />
          <View style={styles.summaryCard}>
            <SummaryRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
            <SummaryRow label="Delivery" value={`$${deliveryCost.toFixed(2)}`} />
            <SummaryRow
              label="Discount"
              value={`-$${discount.toFixed(2)}`}
              isDiscount
            />
            <SummaryRow label="Total" value={`$${total.toFixed(2)}`} isTotal />
          </View>
        </View>

      </ScrollView>

      {/* 8. Sticky Bottom CTA */}
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) }]}>
        <View style={styles.bottomTotalWrapper}>
          <Text style={styles.bottomTotalLabel}>Total</Text>
          <Text style={styles.bottomTotalAmount}>${total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutBtn} onPress={handlePlaceOrder} activeOpacity={0.8}>
          <Text style={styles.checkoutBtnText}>Continue Payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CheckoutScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.l,
    paddingBottom: 140, // Space for sticky bottom sheet
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  headerTitle: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.light,
  },

  // Sections
  section: {
    marginBottom: Theme.spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.l,
  },
  sectionTitle: {
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
  },
  sectionAction: {
    ...Theme.typography.button,
    color: Theme.colors.primary,
  },

  // Premium Card Base
  card: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    ...Theme.shadows.light,
  },

  // Address
  addressCard: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    ...Theme.shadows.medium,
  },
  addressIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
  },
  addressInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  addressName: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    marginBottom: 2,
  },
  addressPhone: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.s,
  },
  addressText: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    lineHeight: 22,
  },

  // Delivery Method Cards
  methodRow: {
    flexDirection: 'row',
    gap: Theme.spacing.m,
  },
  methodCard: {
    flex: 1,
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    position: 'relative',
    ...Theme.shadows.light,
  },
  methodCardActive: {
    backgroundColor: Theme.colors.surface.light,
    ...Theme.shadows.medium,
    borderColor: Theme.colors.primary,
    borderWidth: 2,
  },
  radioCircle: {
    position: 'absolute',
    top: Theme.spacing.m,
    right: Theme.spacing.m,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: Theme.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Theme.colors.primary,
  },
  methodTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    marginTop: Theme.spacing.m,
    fontWeight: '600',
  },
  methodTitleActive: {
    color: Theme.colors.primary,
    fontWeight: '800',
  },
  methodTime: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginTop: 4,
  },

  // Note
  noteContainer: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.l,
    ...Theme.shadows.light,
  },
  noteInput: {
    ...Theme.typography.body1,
    color: Theme.colors.text.primaryLight,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Payment Preview
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentText: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    marginLeft: Theme.spacing.m,
    fontWeight: '600',
  },

  // Summary
  summaryCard: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    ...Theme.shadows.medium,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.m,
  },
  totalRowMargin: {
    marginTop: Theme.spacing.l,
    marginBottom: 0,
  },
  summaryLabel: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
  },
  summaryLabelBold: {
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
  },
  summaryValue: {
    ...Theme.typography.body1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  summaryValueBold: {
    ...Theme.typography.h2,
    color: Theme.colors.primary,
    fontWeight: '800',
  },

  // Sticky Checkout Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Theme.colors.surface.light,
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...Theme.shadows.large,
  },
  bottomTotalWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  bottomTotalLabel: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginBottom: 4,
  },
  bottomTotalAmount: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
  },
  checkoutBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: Theme.spacing.xl,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  checkoutBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.surface.light,

  },
});
