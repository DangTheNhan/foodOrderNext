import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { useFilterStore } from '../../stores/filterStore';
import { FoodService } from '../../services/FoodService';

export default function FilterScreen({ navigation }) {
  const filters = useFilterStore(state => state.filters);
  const setFilter = useFilterStore(state => state.setFilter);
  const resetFilters = useFilterStore(state => state.resetFilters);
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await FoodService.getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to load categories', error);
      }
    };
    fetchCategories();
  }, []);

  const priceRanges = [
    { id: 'all', label: 'All Prices' },
    { id: 'cheap', label: 'Under $10' },
    { id: 'expensive', label: '$10 & Above' },
  ];

  const ratings = [
    { id: 0, label: 'Any' },
    { id: 4.0, label: '4.0+' },
    { id: 4.5, label: '4.5+' },
  ];

  const deliveryTimes = [
    { id: 'any', label: 'Any Time' },
    { id: 'under_20', label: 'Under 20 min' },
    { id: 'under_40', label: 'Under 40 min' },
  ];

  // ─── Filter Section Card ────────────────────────────────────────────────────
  const renderFilterGroup = (title, options, selectedId, filterKey) => (
    <View style={styles.filterCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipGroup}>
        {options.map((option) => {
          const isActive = selectedId === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setFilter(filterKey, option.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {option.name || option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) + 140 },
        ]}
      >
        {/* 1. Premium Header with Close + Reset */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
            activeOpacity={0.8}
          >
            <Icon name="close" size={24} color={Theme.colors.text.primaryLight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={resetFilters} activeOpacity={0.7}>
            <Text style={styles.resetText}>Reset All</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Hero Header */}
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Filters</Text>
          <Text style={styles.heroSubtitle}>Find exactly what you're craving.</Text>
        </View>

        {/* 3. Filter Section Cards */}
        {renderFilterGroup('Category', categories, filters.category, 'category')}
        {renderFilterGroup('Price Range', priceRanges, filters.priceRange, 'priceRange')}
        {renderFilterGroup('Rating', ratings, filters.rating, 'rating')}
        {renderFilterGroup('Delivery Time', deliveryTimes, filters.deliveryTime, 'deliveryTime')}
      </ScrollView>

      {/* 4. Sticky Bottom CTA Sheet */}
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) }]}>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={styles.applyBtnText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
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

  // Header Row (Close + Reset — no shadow, top of hierarchy)
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.l,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.light,
  },
  resetText: {
    ...Theme.typography.button,
    color: Theme.colors.primary,
    fontWeight: '700',
  },

  // Hero Header (no shadow)
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

  // Filter Section Cards (medium shadow — elevation anchor)
  filterCard: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxl,
    ...Theme.shadows.medium,
  },
  sectionTitle: {
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    marginBottom: Theme.spacing.l,
  },

  // Chips
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.m,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: Theme.spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.background.light,
    ...Theme.shadows.light,
  },
  chipActive: {
    backgroundColor: Theme.colors.primary,
    ...Theme.shadows.light, // Chips stay lighter than cards
  },
  filterLabel: {
    ...Theme.typography.body1,
    color: Theme.colors.text.primaryLight,
  },
  chipText: {
    ...Theme.typography.body2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Theme.colors.surface.light,
    fontWeight: '800',
  },

  // Sticky Bottom Sheet (large shadow — heaviest in hierarchy, fake blur)
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Theme.colors.surface.light,
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.xxl, // Extra breathing room reinforces floating illusion
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 0, // No border — pure shadow separation
    ...Theme.shadows.large,
  },
  applyBtn: {
    height: 56,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  applyBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.surface.light,
    fontWeight: '700',

  },
});
