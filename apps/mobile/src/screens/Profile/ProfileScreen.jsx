import React, { useState, useEffect } from 'react';
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
import { useAuthStore } from '../../stores/authStore';
import { ProfileService } from '../../services/ProfileService';
import { LoadingOverlay } from '../../common';

// ─── Constants ────────────────────────────────────────────────────────────────
const COMING_SOON_MESSAGE = 'This feature will be available soon.';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getInitials = (fullName = '') =>
  fullName
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

// ─── Action Card Row ──────────────────────────────────────────────────────────
const ActionCardRow = ({ icon, label, onPress, isDanger = false, hideBorder = false }) => (
  <TouchableOpacity
    style={[styles.actionCardRow, !hideBorder && styles.actionCardBorder]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.actionIconBox, isDanger && styles.actionIconBoxDanger]}>
      <Icon
        name={icon}
        size={24}
        color={isDanger ? Theme.colors.feedback.error : Theme.colors.primary}
      />
    </View>
    <Text style={[styles.actionLabel, isDanger && styles.actionLabelDanger]}>{label}</Text>
    {!isDanger && (
      <Icon name="chevron-forward" size={20} color={Theme.colors.text.secondary} />
    )}
  </TouchableOpacity>
);


// ─── Profile Info Row ─────────────────────────────────────────────────────────
const ProfileInfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <Icon name={icon} size={22} color={Theme.colors.text.secondary} />
    </View>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
  const { signOut } = useAuthStore();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await ProfileService.getProfile();
      setCustomer(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadProfile);
    return unsubscribe;
  }, [navigation]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Auth' }],
          });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay isVisible message="Loading profile..." />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ ...Theme.typography.body1, color: Theme.colors.text.secondary }}>Failed to load profile. Please try again.</Text>
        <TouchableOpacity style={{ marginTop: 16, padding: 12, paddingHorizontal: 24, backgroundColor: Theme.colors.primary, borderRadius: 8 }} onPress={loadProfile}>
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = getInitials(customer.name);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, Theme.spacing.xxl) + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Profile Header */}
        <View style={styles.heroSection}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.headerName}>{customer.name}</Text>
          <Text style={styles.headerEmail}>{customer.email}</Text>
        </View>


        {/* 3. Contact Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Information</Text>
          <ProfileInfoRow icon="call" label="Phone Number" value={customer.phone || 'Not set'} />
          <View style={{ height: Theme.spacing.l }} />
          <ProfileInfoRow icon="location" label="Delivery Address" value={customer.address || 'Not set'} />
        </View>

        {/* 4. Account Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Settings</Text>
          <ActionCardRow
            icon="person"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile', { customer })}
          />
          <ActionCardRow
            icon="lock-closed"
            label="Change Password"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <ActionCardRow
            icon="receipt"
            label="Order History"
            onPress={() => navigation.navigate('OrderStack')}
          />
          <ActionCardRow
            icon="settings"
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
            hideBorder
          />
        </View>

        {/* 5. Logout Card */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutCard}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={styles.logoutIconBox}>
              <Icon name="log-out" size={24} color={Theme.colors.feedback.error} />
            </View>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.l,
  },

  // Hero Header
  heroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  avatarOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Theme.colors.surface.light,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.l,
    ...Theme.shadows.large,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    ...Theme.typography.h1,
    color: Theme.colors.surface.light,
  },
  headerName: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    marginBottom: 4,
    fontWeight: '800',
  },
  headerEmail: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.l,
  },

  // Premium Cards
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

  // Info Rows (Contact)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
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

  // Action Rows
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56, // 56px minimum touch target
    paddingVertical: Theme.spacing.s,
  },
  actionCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.background.light,
    marginBottom: Theme.spacing.s,
    paddingBottom: Theme.spacing.m,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
  },
  actionIconBoxDanger: {
    backgroundColor: Theme.colors.feedback.error + '10',
  },
  actionLabel: {
    flex: 1,
    ...Theme.typography.h3,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  actionLabelDanger: {
    color: Theme.colors.feedback.error,
  },

  // Logout
  logoutSection: {
    marginBottom: Theme.spacing.xxl,
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.l,
    minHeight: 64,
    ...Theme.shadows.medium,
  },
  logoutIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.feedback.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
  },
  logoutText: {
    ...Theme.typography.h3,
    color: Theme.colors.feedback.error,
    fontWeight: '700',
  },
});
