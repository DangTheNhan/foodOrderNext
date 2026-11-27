import React from 'react';
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

// ─── Static data ──────────────────────────────────────────────────────────────
const MOCK_ESTIMATED_TIME = '25–35 mins';

const MOCK_COURIER = {
  name: 'James Carter',
  phone: '+1 555 234 5678',
  vehicle: 'Motorcycle · ABC-1234',
};

const ORDER_STEPS = [
  { id: 'placed',    label: 'Order Placed',     icon: 'receipt',   },
  { id: 'preparing', label: 'Preparing',         icon: 'restaurant', },
  { id: 'delivery',  label: 'Out for Delivery',  icon: 'bicycle',   },
  { id: 'delivered', label: 'Delivered',          icon: 'home',      },
];

// Current step index (0-based). "Preparing" = index 1.
const CURRENT_STEP_INDEX = 1;

// ─── Timeline Step ────────────────────────────────────────────────────────────
const TimelineStep = ({ step, index, isLast }) => {
  const isDone    = index < CURRENT_STEP_INDEX;
  const isCurrent = index === CURRENT_STEP_INDEX;
  const isFuture  = index > CURRENT_STEP_INDEX;

  return (
    <View style={styles.stepRow}>
      {/* Left column: connector + indicator */}
      <View style={styles.stepIndicatorCol}>
        {/* Top connector line */}
        <View style={[
          styles.connectorLine,
          styles.connectorTop,
          (isDone || isCurrent) && styles.connectorActive,
          index === 0 && styles.connectorHidden,
        ]} />

        {/* Step dot */}
        <View style={[
          styles.stepDot,
          isDone    && styles.stepDotDone,
          isCurrent && styles.stepDotCurrent,
          isFuture  && styles.stepDotFuture,
        ]}>
          {isDone && (
            <Icon name="checkmark" size={16} color={Theme.colors.surface.light} />
          )}
          {isCurrent && (
            <View style={styles.stepDotInner} />
          )}
        </View>

        {/* Bottom connector line */}
        <View style={[
          styles.connectorLine,
          styles.connectorBottom,
          isDone && styles.connectorActive,
          isLast && styles.connectorHidden,
        ]} />
      </View>

      {/* Right column: icon + text */}
      <View style={[styles.stepContent, isCurrent && styles.stepContentCurrent]}>
        <View style={[
          styles.stepIconCircle,
          isDone    && styles.stepIconDone,
          isCurrent && styles.stepIconCurrent,
          isFuture  && styles.stepIconFuture,
        ]}>
          <Icon
            name={step.icon}
            size={isCurrent ? 24 : 20}
            color={isFuture ? Theme.colors.text.secondary : Theme.colors.surface.light}
          />
        </View>
        <View style={styles.stepTextBlock}>
          <Text style={[
            styles.stepLabel,
            isFuture && styles.stepLabelFuture,
            isCurrent && styles.stepLabelCurrent,
          ]}>
            {step.label}
          </Text>
          {isCurrent && (
            <Text style={styles.stepSubLabel}>Restaurant is preparing your order</Text>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Info Row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, highlightValue = false }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <Icon name={icon} size={20} color={highlightValue ? Theme.colors.primary : Theme.colors.text.secondary} />
    </View>
    <View style={styles.infoTextBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlightValue && styles.infoValueHighlight]}>{value}</Text>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TrackOrderScreen = ({ navigation, route }) => {
  const orderId        = route?.params?.orderId        ?? 'ORD-000000';
  const paymentMethod  = route?.params?.paymentMethod  ?? 'N/A';
  const deliveryAddress = route?.params?.deliveryAddress ?? 'N/A';
  const insets         = useSafeAreaInsets();

  const handleBackToHome = () => {
    navigation.popToTop();
    navigation.navigate('HomeStack');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Premium Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            activeOpacity={0.8}
          >
            <Icon name="arrow-back" size={24} color={Theme.colors.text.primaryLight} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Order</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* 2. Order Status Timeline Hero */}
        <View style={[styles.card, styles.heroTimelineCard]}>
          {ORDER_STEPS.map((step, index) => (
            <TimelineStep
              key={step.id}
              step={step}
              index={index}
              isLast={index === ORDER_STEPS.length - 1}
            />
          ))}
        </View>

        {/* 3. Estimated Arrival Highlight */}
        <View style={styles.arrivalCard}>
          <Text style={styles.arrivalLabel}>Estimated Arrival</Text>
          <Text style={styles.arrivalValue}>{MOCK_ESTIMATED_TIME}</Text>
        </View>

        {/* 4. Courier Details */}
        <View style={styles.card}>
          <View style={styles.courierRow}>
            <View style={styles.courierAvatar}>
              <Icon name="person" size={32} color={Theme.colors.text.secondary} />
            </View>
            <View style={styles.courierInfo}>
              <Text style={styles.courierName}>{MOCK_COURIER.name}</Text>
              <View style={styles.courierMeta}>
                <Text style={styles.courierVehicle}>{MOCK_COURIER.vehicle}</Text>
                <Icon name="star" size={14} color="#FFD700" style={{ marginLeft: 8 }} />
                <Text style={styles.courierRating}>4.9</Text>
              </View>
            </View>
          </View>
          <View style={styles.courierActions}>
            <TouchableOpacity style={styles.courierActionBtn} onPress={() => Alert.alert('Calling Courier...')} activeOpacity={0.8}>
              <Icon name="call" size={20} color={Theme.colors.primary} />
              <Text style={styles.courierActionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.courierActionBtn} onPress={() => Alert.alert('Messaging Courier...')} activeOpacity={0.8}>
              <Icon name="chatbubble-ellipses" size={20} color={Theme.colors.primary} />
              <Text style={styles.courierActionText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Order Information */}
        <View style={styles.card}>
          <InfoRow icon="receipt-outline"   label="Order ID"           value={orderId} />
          <InfoRow icon="wallet-outline"    label="Payment Method"     value={paymentMethod} />
          <InfoRow icon="location-outline"  label="Delivery Address"   value={deliveryAddress} />
        </View>

      </ScrollView>

      {/* 6. Bottom Action */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, Theme.spacing.xxl) }]}>
        <TouchableOpacity style={styles.homeBtnGhost} onPress={handleBackToHome} activeOpacity={0.7}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TrackOrderScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.l,
    paddingBottom: 40,
  },

  // Premium Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...Theme.typography.h1,
    fontWeight: '800',
    color: Theme.colors.text.primaryLight,
  },
  headerSpacer: {
    width: 48,
  },

  // Premium Cards
  card: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxl,
    ...Theme.shadows.medium,
  },
  
  // Timeline Hero
  heroTimelineCard: {
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.l,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepIndicatorCol: {
    width: 32,
    alignItems: 'center',
  },
  connectorLine: {
    width: 3,
    flex: 1,
    backgroundColor: Theme.colors.border,
  },
  connectorTop: {
    marginBottom: 4,
  },
  connectorBottom: {
    marginTop: 4,
  },
  connectorActive: {
    backgroundColor: Theme.colors.primary,
  },
  connectorHidden: {
    backgroundColor: 'transparent',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.border,
  },
  stepDotDone: {
    backgroundColor: Theme.colors.primary,
  },
  stepDotCurrent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.primary + '30', // glow
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotFuture: {
    backgroundColor: Theme.colors.border,
  },
  stepDotInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Theme.colors.primary,
  },

  // Step Content
  stepContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Theme.spacing.m,
    paddingVertical: Theme.spacing.m,
    paddingRight: Theme.spacing.s,
    marginBottom: Theme.spacing.s,
  },
  stepContentCurrent: {
    backgroundColor: Theme.colors.primary + '05',
    borderRadius: Theme.radius.large,
  },
  stepIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
  },
  stepIconDone: {
    backgroundColor: Theme.colors.primary,
  },
  stepIconCurrent: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Theme.colors.primary,
    ...Theme.shadows.medium, // Elevation for current step
  },
  stepIconFuture: {
    backgroundColor: Theme.colors.background.light,
  },
  stepTextBlock: {
    flex: 1,
  },
  stepLabel: {
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
  },
  stepLabelCurrent: {
    color: Theme.colors.primary,
    fontWeight: '800',

  },
  stepLabelFuture: {
    color: Theme.colors.text.secondary,
    fontWeight: '500',
  },
  stepSubLabel: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginTop: 4,
  },

  // Estimated Arrival Card
  arrivalCard: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  arrivalLabel: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    marginBottom: 4,
  },
  arrivalValue: {
    ...Theme.typography.h1,
    color: Theme.colors.primary,
    fontWeight: '800',
  },

  // Courier Card
  courierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  courierAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.l,
    ...Theme.shadows.light,
  },
  courierInfo: {
    flex: 1,
  },
  courierName: {
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
    marginBottom: 4,
  },
  courierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courierVehicle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
  },
  courierRating: {
    ...Theme.typography.body2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    marginLeft: 4,
  },
  courierActions: {
    flexDirection: 'row',
    gap: Theme.spacing.m,
  },
  courierActionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  courierActionText: {
    ...Theme.typography.button,
    color: Theme.colors.primary,
    marginLeft: 8,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.s,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.background.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
  },
  infoTextBlock: {
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
  infoValueHighlight: {
    color: Theme.colors.primary,
    fontWeight: '800',
  },

  // Bottom Action
  bottomSection: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.l,
    backgroundColor: Theme.colors.background.light,
  },
  homeBtnGhost: {
    height: 56,
    borderRadius: Theme.radius.pill,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  homeBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.text.primaryLight,

  },
});
