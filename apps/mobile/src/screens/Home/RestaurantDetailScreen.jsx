import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { FoodService } from '../../services/FoodService';

export default function RestaurantDetailScreen({ navigation, route }) {
  const { restaurantId } = route.params;
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const restaurants = await FoodService.getNearbyRestaurants();
        setRestaurant(restaurants.find(r => r.id === restaurantId));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurant();
  }, [restaurantId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Icon name="arrow-back" size={24} color={Theme.colors.text.primaryLight} />
        </TouchableOpacity>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Restaurant not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: restaurant.imageUrl }} style={styles.heroImage} resizeMode="cover" />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnOverlay} activeOpacity={0.8}>
          <Icon name="arrow-back" size={24} color={Theme.colors.text.primaryLight} />
        </TouchableOpacity>
        <View style={styles.content}>
          <Text style={styles.name}>{restaurant.name}</Text>
          <View style={styles.metaRow}>
            <Icon name="star" size={16} color="#FFD700" />
            <Text style={styles.rating}>{restaurant.rating}</Text>
            <Icon name="location" size={14} color={Theme.colors.text.secondary} style={{ marginLeft: 16, marginRight: 4 }} />
            <Text style={styles.distance}>{restaurant.distance}</Text>
          </View>
          {restaurant.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>About</Text>
              <Text style={styles.descriptionText}>{restaurant.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background.light },
  heroImage: { width: '100%', height: 260, backgroundColor: Theme.colors.border },
  backBtnOverlay: { position: 'absolute', top: Theme.spacing.l, left: Theme.spacing.l, width: 44, height: 44, borderRadius: 22, backgroundColor: Theme.colors.surface.light, justifyContent: 'center', alignItems: 'center', ...Theme.shadows.light },
  backBtn: { margin: Theme.spacing.l, width: 44, height: 44, borderRadius: 22, backgroundColor: Theme.colors.surface.light, justifyContent: 'center', alignItems: 'center', ...Theme.shadows.light },
  content: { padding: Theme.spacing.xl },
  name: { ...Theme.typography.h1, color: Theme.colors.text.primaryLight, fontWeight: '800', marginBottom: Theme.spacing.m },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  rating: { ...Theme.typography.body1, color: Theme.colors.text.primaryLight, fontWeight: '700', marginLeft: 6 },
  distance: { ...Theme.typography.body1, color: Theme.colors.text.secondary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...Theme.typography.body1, color: Theme.colors.text.secondary },
  descriptionContainer: { marginTop: Theme.spacing.xl, paddingTop: Theme.spacing.l, borderTopWidth: 1, borderTopColor: Theme.colors.border },
  descriptionLabel: { ...Theme.typography.h3, color: Theme.colors.text.primaryLight, fontWeight: '700', marginBottom: Theme.spacing.s },
  descriptionText: { ...Theme.typography.body1, color: Theme.colors.text.secondary, lineHeight: 24 }
});
