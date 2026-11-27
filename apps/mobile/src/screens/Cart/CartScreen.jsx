import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { useCartStore } from '../../stores/cartStore';
import { PrimaryButton } from '../../common';
import { DELIVERY_FEE, DISCOUNT_RATE } from '../../constants/cartConstants';

// ─── Cart Item Row ────────────────────────────────────────────────────────────
const CartItem = ({ item, onIncrease, onDecrease, onRemove }) => {
  const lineTotal = item.food.price * item.quantity;

  return (
    <View style={styles.card}>
      <Image source={{ uri: item.food.imageUrl }} style={styles.image} resizeMode="cover" />

      <View style={styles.itemInfo}>
        <View style={styles.itemHeaderRow}>
          <Text style={styles.itemName} numberOfLines={1}>{item.food.name}</Text>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={onRemove}
            accessibilityLabel="Remove item"
            activeOpacity={0.7}
          >
            <Icon name="close" size={20} color={Theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {item.food.category && (
          <Text style={styles.itemVariant}>{item.food.category}</Text>
        )}
        
        <Text style={styles.itemUnitPrice}>${item.food.price.toFixed(2)}</Text>

        <View style={styles.itemFooter}>
          <Text style={styles.lineTotal}>${lineTotal.toFixed(2)}</Text>

          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={[styles.qtyBtn, item.quantity <= 1 && styles.qtyBtnDisabled]}
              onPress={onDecrease}
              accessibilityLabel="Decrease quantity"
              activeOpacity={0.7}
            >
              <Icon
                name="remove"
                size={18}
                color={item.quantity <= 1 ? Theme.colors.text.secondary : Theme.colors.text.primaryLight}
              />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={onIncrease}
              accessibilityLabel="Increase quantity"
              activeOpacity={0.7}
            >
              <Icon name="add" size={18} color={Theme.colors.text.primaryLight} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Summary Row ──────────────────────────────────────────────────────────────
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

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyCart = ({ onContinueShopping }) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconCircle}>
      <Icon name="cart-outline" size={72} color={Theme.colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>Your cart is empty</Text>
    <Text style={styles.emptySubText}>
      Looks like you haven't added anything yet. Let's fix that!
    </Text>
    <PrimaryButton
      title="Browse Foods"
      onPress={onContinueShopping}
      style={styles.continueBtn}
    />
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const CartScreen = ({ navigation }) => {
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCartStore();
  const insets = useSafeAreaInsets();

  // Calculations
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.food.price * item.quantity,
    0
  );
  const discount = subtotal * DISCOUNT_RATE;
  const total = subtotal + DELIVERY_FEE - discount;

  const handleDecrease = (item) => {
    if (item.quantity <= 1) {
      handleRemove(item.food.id, item.food.name);
    } else {
      updateQuantity(item.food.id, item.quantity - 1);
    }
  };

  const handleRemove = (foodId, foodName) => {
    Alert.alert(
      'Remove Item',
      `Remove "${foodName}" from your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(foodId) },
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearCart },
      ]
    );
  };

  const handleCheckout = () => {
    navigation.navigate('Checkout');
  };

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <EmptyCart onContinueShopping={() => navigation.navigate('HomeStack')} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header (Respecting top safe area manually) */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.headerTitle}>
          My Cart <Text style={styles.headerItemCount}>({cartItems.length})</Text>
        </Text>
        <TouchableOpacity onPress={handleClearCart} accessibilityLabel="Clear cart" activeOpacity={0.7} style={styles.clearBtn}>
          <Icon name="trash-outline" size={20} color={Theme.colors.feedback.error} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.food.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CartItem
            item={item}
            onIncrease={() => updateQuantity(item.food.id, item.quantity + 1)}
            onDecrease={() => handleDecrease(item)}
            onRemove={() => handleRemove(item.food.id, item.food.name)}
          />
        )}
        ListFooterComponent={() => (
          <View style={styles.summaryCard}>
            <SummaryRow label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
            <SummaryRow label="Delivery Fee" value={`$${DELIVERY_FEE.toFixed(2)}`} />
            <SummaryRow
              label="Discount"
              value={`-$${discount.toFixed(2)}`}
              isDiscount
            />
            <SummaryRow label="Total" value={`$${total.toFixed(2)}`} isTotal />
          </View>
        )}
      />

      {/* Sticky Bottom Checkout Sheet */}
      <View style={[styles.checkoutSheet, { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) }]}>
        <PrimaryButton
          title={`Checkout • $${total.toFixed(2)}`}
          onPress={handleCheckout}
          style={styles.checkoutBtn}
        />
      </View>
    </View>
  );
};

export default CartScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.l,
    paddingBottom: Theme.spacing.l,
  },
  headerTitle: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
  },
  headerItemCount: {
    ...Theme.typography.h2,
    color: Theme.colors.text.secondary,
    fontWeight: '600',
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.feedback.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // List
  listContent: {
    paddingHorizontal: Theme.spacing.l,
    paddingBottom: 140, // Room for checkout sheet
  },

  // Premium Cart Item Card
  card: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface.light,
    borderRadius: 24,
    padding: Theme.spacing.s,
    paddingRight: Theme.spacing.m,
    marginBottom: Theme.spacing.l,
    ...Theme.shadows.medium,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: Theme.colors.border,
  },
  itemInfo: {
    flex: 1,
    marginLeft: Theme.spacing.m,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    flex: 1,
    marginRight: Theme.spacing.s,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemVariant: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  itemUnitPrice: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginTop: 2,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Theme.spacing.s,
  },
  lineTotal: {
    ...Theme.typography.h3,
    color: Theme.colors.primary,
    fontWeight: '800',
  },

  // Premium Quantity selector
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.light,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.light,
  },
  qtyBtnDisabled: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  qtyText: {
    ...Theme.typography.body1,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
    color: Theme.colors.text.primaryLight,
  },

  // Premium Summary Card
  summaryCard: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: 24,
    padding: Theme.spacing.xl,
    marginTop: Theme.spacing.s,
    marginBottom: Theme.spacing.xxl,
    ...Theme.shadows.light,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.m,
  },
  totalRowMargin: {
    marginTop: Theme.spacing.m,
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
  checkoutSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Theme.colors.surface.light,
    paddingHorizontal: Theme.spacing.l,
    paddingTop: Theme.spacing.l,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...Theme.shadows.large,
  },
  checkoutBtn: {
    borderRadius: Theme.radius.pill,
    paddingVertical: 18,
  },

  // Premium Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    paddingBottom: 100,
  },
  emptyIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  emptyTitle: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    marginBottom: Theme.spacing.s,
    fontWeight: '800',
  },
  emptySubText: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.m,
  },
  continueBtn: {
    paddingHorizontal: Theme.spacing.xxxl,
    borderRadius: Theme.radius.pill,
    paddingVertical: 16,
  },
});
