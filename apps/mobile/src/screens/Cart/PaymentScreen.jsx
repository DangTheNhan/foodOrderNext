import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { useCartStore } from '../../stores/cartStore';
import { PrimaryButton, LoadingOverlay } from '../../common';
import { PAYMENT_METHODS } from '../../constants/paymentMethods';
import { DELIVERY_FEE, DISCOUNT_RATE } from '../../constants/cartConstants';
import { OrderService } from '../../services/OrderService';

// ─── Summary Row ──────────────────────────────────────────────────────────────
const SummaryRow = ({ label, value, isTotal = false, isDiscount = false }) => (
  <View style={[styles.summaryRow, isTotal && styles.summaryRowTotal]}>
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

// ─── Payment Option Card ──────────────────────────────────────────────────────
const PaymentOptionCard = ({ method, isSelected, onSelect }) => (
  <TouchableOpacity
    style={[styles.methodCard, isSelected && styles.methodCardSelected]}
    onPress={() => onSelect(method.id)}
    activeOpacity={0.8}
    accessibilityLabel={`Select ${method.label}`}
  >
    <View style={[styles.methodIconCircle, isSelected && styles.methodIconCircleSelected]}>
      <Icon
        name={method.icon}
        size={26}
        color={isSelected ? Theme.colors.surface.light : Theme.colors.text.secondary}
      />
    </View>
    <Text style={[styles.methodLabel, isSelected && styles.methodLabelSelected]}>
      {method.label}
    </Text>
    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
      {isSelected && <View style={styles.radioInner} />}
    </View>
  </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const PaymentScreen = ({ navigation, route }) => {
  const { cartItems, clearCart } = useCartStore();
  const deliveryMethod = route?.params?.deliveryMethod ?? 'Standard';
  const insets = useSafeAreaInsets();

  const [selectedMethodId, setSelectedMethodId] = useState(PAYMENT_METHODS[0].id);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.food.price * item.quantity, 0);
  const discount = subtotal * DISCOUNT_RATE;
  const deliveryCost = deliveryMethod === 'Express' ? DELIVERY_FEE + 2.0 : DELIVERY_FEE;
  const total = subtotal + deliveryCost - discount;

  const selectedMethod = PAYMENT_METHODS.find((m) => m.id === selectedMethodId);

  const handleConfirmOrder = async () => {
    if (!selectedMethodId) {
      Alert.alert('No Payment Method', 'Please select a payment method to continue.');
      return;
    }
    
    setIsProcessing(true);
    try {
      const orderData = {
        restaurant_id: cartItems[0]?.food?.restaurantId || '1',
        total_price: total,
        delivery_address: route?.params?.address || 'Default Address',
        payment_method: selectedMethod?.label,
        details: cartItems.map(item => ({
          food_id: item.food.id,
          quantity: item.quantity,
          sub_total: item.food.price * item.quantity
        }))
      };
      
      const result = await OrderService.createOrder(orderData);
      clearCart();
      navigation.replace('OrderSuccess', {
        orderId: result.orderId,
        paymentMethod: selectedMethod?.label,
        deliveryAddress: route?.params?.address || 'Default Address',
      });
    } catch (error) {
      Alert.alert('Order Failed', 'Could not process your order. Please try again.');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <LoadingOverlay isVisible={isProcessing} message="Processing Payment..." />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Icon name="arrow-back" size={24} color={Theme.colors.text.primaryLight} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* 2. Payment Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          <View style={styles.methodList}>
            {PAYMENT_METHODS.map((method) => (
              <PaymentOptionCard
                key={method.id}
                method={method}
                isSelected={selectedMethodId === method.id}
                onSelect={setSelectedMethodId}
              />
            ))}
          </View>
        </View>

        {/* 3. Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <SummaryRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
            <SummaryRow
              label={`Delivery Fee (${deliveryMethod})`}
              value={`$${deliveryCost.toFixed(2)}`}
            />
            <SummaryRow
              label={`Discount (${(DISCOUNT_RATE * 100).toFixed(0)}%)`}
              value={`-$${discount.toFixed(2)}`}
              isDiscount
            />
            <SummaryRow label="Total" value={`$${total.toFixed(2)}`} isTotal />
          </View>
        </View>
      </ScrollView>

      {/* 4. Sticky Bottom CTA */}
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) }]}>
        <View style={styles.bottomTotalWrapper}>
          <Text style={styles.bottomTotalLabel}>Total Payment</Text>
          <Text style={styles.bottomTotalAmount}>${total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmOrder} activeOpacity={0.8}>
          <Text style={styles.confirmBtnText}>Confirm Order</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PaymentScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.l,
    paddingBottom: 160, // Deep breathing room for sticky bottom CTA
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
  sectionTitle: {
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    marginBottom: Theme.spacing.l,
    fontWeight: '700',
  },

  // Payment method cards
  methodList: {
    gap: Theme.spacing.m,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Theme.shadows.light,
  },
  methodCardSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: '#FFF0ED', // Solid color to prevent shadow bleeding on Android
  },
  methodIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Theme.colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
  },
  methodIconCircleSelected: {
    backgroundColor: Theme.colors.primary,
  },
  methodLabel: {
    flex: 1,
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  methodLabelSelected: {
    color: Theme.colors.primary,
    fontWeight: '800',
  },

  // Radio button
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Theme.colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Theme.colors.primary,
  },

  // Order summary
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
  summaryRowTotal: {
    marginTop: Theme.spacing.xl, // Replace divider with whitespace
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
    ...Theme.typography.h1,
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
  confirmBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: Theme.spacing.xl,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  confirmBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.surface.light,

  },
});
