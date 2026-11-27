import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_INFO = {
  name: 'FoodOrderingApp',
  version: '1.0.0',
  developer: 'Capstone Project',
  build: 'Development',
};

// ─── Row Components ───────────────────────────────────────────────────────────
const SwitchRow = ({ icon, label, value, onValueChange, tint }) => (
  <View style={styles.row}>
    <View style={[styles.iconCircle, tint && { backgroundColor: tint }]}>
      <Icon name={icon} size={22} color={Theme.colors.surface.light} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: Theme.colors.border, true: Theme.colors.primary + '80' }}
      thumbColor={value ? Theme.colors.primary : Theme.colors.surface.light}
    />
  </View>
);

const ActionRow = ({ icon, label, onPress, tint }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.iconCircle, tint && { backgroundColor: tint }]}>
      <Icon name={icon} size={22} color={Theme.colors.surface.light} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    <Icon name="chevron-forward" size={20} color={Theme.colors.text.secondary} />
  </TouchableOpacity>
);

const ActionValueRow = ({ icon, label, value, onPress, tint }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.iconCircle, tint && { backgroundColor: tint }]}>
      <Icon name={icon} size={22} color={Theme.colors.surface.light} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
    <Icon name="chevron-forward" size={20} color={Theme.colors.text.secondary} />
  </TouchableOpacity>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const SettingsScreen = ({ navigation }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [language] = useState('English');
  const insets = useSafeAreaInsets();

  const handleComingSoon = () => {
    Alert.alert('Coming Soon', 'This feature will be available in a future phase.');
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Header — no shadow */}
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Settings</Text>
          <Text style={styles.heroSubtitle}>Manage your preferences and account settings</Text>
        </View>

        {/* 2. Preferences Card — primary tint icons */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferences</Text>
          <SwitchRow
            icon="notifications"
            label="Push Notifications"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            tint={Theme.colors.primary}
          />
          <View style={styles.rowSpacer} />
          <SwitchRow
            icon="moon"
            label="Dark Mode"
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
            tint={Theme.colors.primary}
          />
          <View style={styles.rowSpacer} />
          <ActionValueRow
            icon="language"
            label="Language"
            value={language}
            onPress={handleComingSoon}
            tint={Theme.colors.primary}
          />
        </View>

        {/* 3. Security Card — warning tint */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security</Text>
          <ActionRow
            icon="lock-closed"
            label="Change Password"
            onPress={() => navigation.navigate('ChangePassword')}
            tint={Theme.colors.feedback.warning}
          />
        </View>

        {/* 4. Support Card — info tint */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support</Text>
          <ActionRow
            icon="help-circle"
            label="Help Center"
            onPress={handleComingSoon}
            tint={Theme.colors.feedback.info}
          />
          <View style={styles.rowSpacer} />
          <ActionRow
            icon="chatbubbles"
            label="Contact Us"
            onPress={handleComingSoon}
            tint={Theme.colors.feedback.info}
          />
          <View style={styles.rowSpacer} />
          <ActionRow
            icon="paper-plane"
            label="Send Feedback"
            onPress={handleComingSoon}
            tint={Theme.colors.feedback.info}
          />
        </View>

        {/* 5. Legal Card — secondary tint */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legal</Text>
          <ActionRow
            icon="shield-checkmark"
            label="Privacy Policy"
            onPress={handleComingSoon}
            tint={Theme.colors.text.secondary}
          />
          <View style={styles.rowSpacer} />
          <ActionRow
            icon="document-text"
            label="Terms & Conditions"
            onPress={handleComingSoon}
            tint={Theme.colors.text.secondary}
          />
        </View>

        {/* 6. About Card — neutral tint */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <InfoRow label="App Version" value={APP_INFO.version} />
          <View style={styles.rowSpacer} />
          <InfoRow label="Developer" value={APP_INFO.developer} />
          <View style={styles.rowSpacer} />
          <InfoRow label="Build" value={APP_INFO.build} />
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.l,
  },

  // Hero Header — no shadow, top of hierarchy
  heroHeader: {
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

  // Floating Cards — medium shadow
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

  // Row Spacer (replaces divider lines)
  rowSpacer: {
    height: Theme.spacing.m,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.m,
    ...Theme.shadows.light,
  },
  rowLabel: {
    flex: 1,
    ...Theme.typography.body1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  rowValue: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginRight: Theme.spacing.s,
  },

  // Info Row (About section)
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
  },
  infoLabel: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
  },
  infoValue: {
    ...Theme.typography.body1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
});
