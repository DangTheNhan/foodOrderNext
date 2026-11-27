import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { FoodService } from '../../services/FoodService';

export default function RestaurantsScreen({ navigation }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const data = await FoodService.getNearbyRestaurants();
        setRestaurants(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Icon name="arrow-back" size={24} color={Theme.colors.text.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nearby Restaurants</Text>
        <View style={{ width: 44 }} />
      </View>
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}>
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <View style={styles.meta}>
                <Icon name="star" size={14} color="#FFD700" />
                <Text style={styles.rating}>{item.rating}</Text>
                <Icon name="location" size={12} color={Theme.colors.text.secondary} style={{ marginLeft: 12, marginRight: 4 }} />
                <Text style={styles.distance}>{item.distance}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background.light },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Theme.spacing.l, paddingVertical: Theme.spacing.m },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Theme.colors.surface.light, justifyContent: 'center', alignItems: 'center', ...Theme.shadows.light },
  headerTitle: { ...Theme.typography.h2, color: Theme.colors.text.primaryLight, fontWeight: '700' },
  listContent: { paddingHorizontal: Theme.spacing.l, paddingBottom: Theme.spacing.xxxl, paddingTop: Theme.spacing.s },
  card: { backgroundColor: Theme.colors.surface.light, borderRadius: Theme.radius.xl, marginBottom: Theme.spacing.l, overflow: 'hidden', ...Theme.shadows.medium },
  image: { width: '100%', height: 160, backgroundColor: Theme.colors.border },
  info: { padding: Theme.spacing.l },
  name: { ...Theme.typography.h3, color: Theme.colors.text.primaryLight, marginBottom: 6 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  rating: { ...Theme.typography.body2, color: Theme.colors.text.primaryLight, fontWeight: '700', marginLeft: 4 },
  distance: { ...Theme.typography.body2, color: Theme.colors.text.secondary },
});
