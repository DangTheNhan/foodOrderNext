import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { useFavoriteStore } from '../../stores/favoriteStore';

export default function FavoriteScreen({ navigation }) {
  const favorites = useFavoriteStore(state => state.favorites);
  const removeFavorite = useFavoriteStore(state => state.removeFavorite);
  const insets = useSafeAreaInsets();

  const handleFoodPress = (id) => {
    navigation.navigate('HomeStack', { screen: 'FoodDetail', params: { foodId: id } });
  };

  // ─── Premium Favorite Card (local, no new component file) ──────────────────
  const renderFavoriteCard = ({ item }) => (
    <View style={styles.card}>
      {/* Food Image */}
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.foodImage}
          resizeMode="cover"
        />
        {/* Subtle dark depth overlay — no gradient, pure View */}
        <View style={styles.imageOverlay} />
        {/* Floating Heart Button */}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => removeFavorite(item.id)}
          activeOpacity={0.8}
        >
          <Icon name="heart" size={22} color={Theme.colors.feedback.error} />
        </TouchableOpacity>
      </View>

      {/* Card Content */}
      <View style={styles.cardContent}>
        {/* Food Name */}
        <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>

        {/* Category */}
        <Text style={styles.categoryText} numberOfLines={1}>{item.category}</Text>

        {/* Meta Pills */}
        <View style={styles.metaRow}>
          {item.rating != null && (
            <View style={styles.pill}>
              <Icon name="star" size={12} color="#FFD700" />
              <Text style={styles.pillText}>{item.rating}</Text>
            </View>
          )}
          {item.deliveryTime != null && (
            <View style={styles.pill}>
              <Icon name="time-outline" size={12} color={Theme.colors.text.secondary} />
              <Text style={styles.pillText}>{item.deliveryTime} min</Text>
            </View>
          )}
        </View>

        {/* Price + CTA Row */}
        <View style={styles.footerRow}>
          <Text style={styles.priceText}>${item.price?.toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => handleFoodPress(item.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.detailsBtnText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // ─── Empty State ───────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyOuterCircle}>
        <View style={styles.emptyInnerCircle}>
          <Icon name="heart-outline" size={60} color={Theme.colors.primary} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>No Favorites Yet</Text>
      <Text style={styles.emptySubtitle}>
        Hit the heart icon on your favourite foods to save them here for easy access.
      </Text>
      <TouchableOpacity
        style={styles.exploreBtn}
        onPress={() => navigation.navigate('HomeStack')}
        activeOpacity={0.85}
      >
        <Text style={styles.exploreBtnText}>Explore Foods</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) + 80 },
        ]}
        ListHeaderComponent={
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Favorites</Text>
            <Text style={styles.heroSubtitle}>Your saved foods, ready whenever you are.</Text>
          </View>
        }
        renderItem={renderFavoriteCard}
        ItemSeparatorComponent={() => <View style={{ height: Theme.spacing.xl }} />}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.l,
    flexGrow: 1,
  },

  // Hero Header (no shadow — top of elevation hierarchy)
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

  // Premium Floating Card (medium shadow)
  card: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    overflow: 'hidden',
    ...Theme.shadows.medium,
  },

  // Food Image
  imageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: Theme.colors.background.light,
    position: 'relative',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  // Subtle depth overlay — no gradient, zero performance cost
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  // Floating Heart Button (light shadow — below card in hierarchy)
  heartBtn: {
    position: 'absolute',
    top: Theme.spacing.m,
    right: Theme.spacing.m,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.light,
  },

  // Card Content
  cardContent: {
    padding: Theme.spacing.xl,
  },
  foodName: {
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryText: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.m,
  },

  // Meta Pills Row
  metaRow: {
    flexDirection: 'row',
    gap: Theme.spacing.s,
    marginBottom: Theme.spacing.l,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.background.light,
    paddingHorizontal: Theme.spacing.m,
    paddingVertical: 6,
    borderRadius: Theme.radius.pill,
    ...Theme.shadows.light,
  },
  pillText: {
    ...Theme.typography.caption,
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },

  // Footer Row
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceText: {
    ...Theme.typography.h1,
    color: Theme.colors.primary,
    fontWeight: '800',
  },
  detailsBtn: {
    height: 56,
    width: 160, // Slightly narrower to let price breathe and dominate
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  detailsBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.surface.light,
    fontWeight: '700',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Theme.spacing.xxxl,
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyOuterCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Theme.colors.primary + '08',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  emptyInnerCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
    marginBottom: Theme.spacing.m,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Theme.spacing.xxl,
  },
  exploreBtn: {
    height: 56,
    paddingHorizontal: Theme.spacing.xxl,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  exploreBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.surface.light,
    fontWeight: '700',

  },
});
