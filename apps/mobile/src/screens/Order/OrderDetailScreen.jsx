import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { OrderService } from '../../services/OrderService';
import {
  StatusBadge,
  PriceTag,
  PrimaryButton,
  LoadingOverlay,
} from '../../common';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatusColorName = (status) => {
  switch (status?.toLowerCase()) {
    case 'completed': return 'success';
    case 'cancelled': return 'error';
    case 'ongoing':   return 'warning';
    default:          return 'info';
  }
};

// ─── Reusable: Info Row with icon container ───────────────────────────────────
const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <Icon name={icon} size={20} color={Theme.colors.text.secondary} />
    </View>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  </View>
);

// ─── Reusable: Summary Row ────────────────────────────────────────────────────
const SummaryRow = ({ label, amount, isTotal, isDiscount }) => (
  <View style={[styles.summaryRow, isTotal && styles.summaryRowTotal]}>
    <Text style={[styles.summaryLabel, isTotal && styles.summaryLabelTotal]}>{label}</Text>
    <Text style={[
      styles.summaryAmount,
      isTotal && styles.summaryAmountTotal,
      isDiscount && styles.discountText,
    ]}>
      {isDiscount ? '-' : ''}${amount?.toFixed(2)}
    </Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    setLoading(true);
    try {
      const data = await OrderService.getOrderById(orderId);
      setOrder(data);
    } catch (error) {
      console.error('Failed to load order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            try {
              await OrderService.updateOrderStatus(orderId, 'Cancelled');
              Alert.alert('Success', 'Order has been cancelled.');
              navigation.navigate('OrderHistory', { filter: 'Cancelled' });
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel order.');
              console.error(error);
            }
          }
        }
      ]
    );
  };

  const handleOrderAgain = () => {
    Alert.alert('Coming Soon', 'Reorder will be implemented later.');
  };

  const handleTrackOrder = () => {
    navigation.navigate('TrackOrder', {
      orderId: order.id,
      paymentMethod: order.paymentMethod,
      deliveryAddress: order.deliveryAddress,
    });
  };

  if (loading || !order) {
    return (
      <View style={styles.container}>
        <LoadingOverlay isVisible={true} message="Loading order details..." />
      </View>
    );
  }

  const subtotal = order.orderDetails?.reduce((acc, item) => acc + item.subTotal, 0) || 0;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Premium Hero Header */}
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Order Details</Text>
          <Text style={styles.heroSubtitle}>Track every detail of your order</Text>
        </View>

        {/* 2. Order Status Hero Card — vertical hierarchy */}
        <View style={[styles.card, styles.heroCard]}>
          <View style={styles.restaurantImageWrapper}>
            <Image
              source={{ uri: order.imageUrl }}
              style={styles.restaurantImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {order.restaurantName || 'Restaurant'}
          </Text>
          <View style={styles.statusBadgeRow}>
            <StatusBadge
              status={getStatusColorName(order.status)}
              label={order.status}
            />
          </View>
          <Text style={styles.orderIdText}>Order #{order.id}</Text>
          <Text style={styles.orderDateText}>
            {new Date(order.orderDate).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* 3. Delivery Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Details</Text>
          <InfoRow icon="location-outline" label="Delivery Address" value={order.deliveryAddress} />
          <View style={styles.rowSpacer} />
          <InfoRow icon="wallet-outline" label="Payment Method" value={order.paymentMethod} />
        </View>

        {/* 4. Ordered Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Items</Text>
          {order.orderDetails?.map((item, index) => (
            <View key={index} style={[styles.itemCard, index > 0 && { marginTop: Theme.spacing.m }]}>
              <View style={styles.itemImageWrapper}>
                {item.product?.imageUrl ? (
                  <Image
                    source={{ uri: item.product.imageUrl }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Icon name="fast-food-outline" size={28} color={Theme.colors.text.secondary} />
                )}
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.product?.nameProduct || 'Unknown Item'}
                </Text>
                <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
              </View>
              <View style={styles.itemPriceBox}>
                <PriceTag price={item.subTotal} />
              </View>
            </View>
          ))}
        </View>

        {/* 5. Cost Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cost Summary</Text>
          <SummaryRow label="Subtotal" amount={subtotal} />
          <SummaryRow label="Delivery Fee" amount={order.deliveryFee || 0} />
          {(order.discount > 0) && (
            <SummaryRow label="Discount" amount={order.discount} isDiscount />
          )}
          {/* Total — xxl spacing instead of divider */}
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>${order.totalPrice?.toFixed(2)}</Text>
          </View>
        </View>

        {/* 6. Contextual Bottom CTA */}
        {order.status?.toLowerCase() === 'completed' && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleOrderAgain} activeOpacity={0.85}>
            <Text style={styles.actionBtnText}>Order Again</Text>
          </TouchableOpacity>
        )}
        {order.status?.toLowerCase() === 'ongoing' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={handleTrackOrder} activeOpacity={0.85}>
              <Text style={styles.actionBtnText}>Track Order</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: Theme.colors.background.light, borderWidth: 1, borderColor: Theme.colors.feedback.error, marginTop: Theme.spacing.s }]} 
              onPress={handleCancelOrder} 
              activeOpacity={0.85}
            >
              <Text style={[styles.actionBtnText, { color: Theme.colors.feedback.error }]}>Cancel Order</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.l,
  },

  // Premium Hero Header (no shadow — top of elevation hierarchy)
  heroHeader: {
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxl,
  },
  heroTitle: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
  },

  // Floating Cards (medium shadow)
  card: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxl,
    ...Theme.shadows.medium,
  },
  cardTitle: {
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    marginBottom: Theme.spacing.l,
  },

  // Status Hero Card — vertical centered layout
  heroCard: {
    alignItems: 'center',
  },
  restaurantImageWrapper: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: Theme.colors.background.light,
    overflow: 'hidden',
    marginBottom: Theme.spacing.l,
    ...Theme.shadows.light,
  },
  restaurantImage: {
    width: 96,
    height: 96,
    borderRadius: 20,
  },
  restaurantName: {
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    marginBottom: Theme.spacing.m,
    textAlign: 'center',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.m,
  },
  orderIdText: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  orderDateText: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },

  // Info Rows (Delivery Details)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    marginBottom: 2,
  },
  infoValue: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  rowSpacer: {
    height: Theme.spacing.l,
  },

  // Order Items — floating mini cards inside parent card
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.light,
    borderRadius: Theme.radius.large,
    padding: Theme.spacing.m,
  },
  itemImageWrapper: {
    width: 72,
    height: 72,
    borderRadius: Theme.radius.standard,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
    overflow: 'hidden',
    ...Theme.shadows.light,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: Theme.radius.standard,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemQty: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
  },
  itemPriceBox: {
    marginLeft: Theme.spacing.m,
    alignItems: 'flex-end',
  },

  // Summary Rows
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.s,
  },
  summaryLabel: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
  },
  summaryAmount: {
    ...Theme.typography.body1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  discountText: {
    color: Theme.colors.feedback.success,
  },
  // Total block — xxl whitespace separation, no divider
  totalBlock: {
    marginTop: Theme.spacing.xxl,
    alignItems: 'center',
  },
  totalLabel: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Theme.spacing.s,
  },
  totalAmount: {
    ...Theme.typography.h1,
    color: Theme.colors.primary,
    fontWeight: '800',

  },

  // Premium CTA Button (medium shadow — matches card hierarchy)
  actionBtn: {
    height: 56,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
    marginBottom: Theme.spacing.l,
  },
  actionBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.surface.light,
    fontWeight: '700',

  },
});
