import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { FoodService } from '../../services/FoodService';
import { FoodCard } from '../../common/organisms/FoodCard';

export default function RecommendedFoodsScreen({ navigation }) {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFoods = async () => {
      try {
        const [popular, recommended] = await Promise.all([
          FoodService.getPopularFoods(),
          FoodService.getRecommendedFoods()
        ]);
        const allFoods = [...popular, ...recommended];
        // Deduplicate foods by id
        const uniqueFoods = Array.from(new Map(allFoods.map(item => [item.id, item])).values());
        setFoods(uniqueFoods.filter(f => f.rating >= 4.7));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchFoods();
  }, []);

  const handleFoodPress = (id) => { navigation.navigate('FoodDetail', { foodId: id }); };

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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>Recommended For You</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>
      <FlatList data={foods} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent} renderItem={({ item }) => <FoodCard {...item} onPress={handleFoodPress} />} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No recommendations available.</Text></View>} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background.light },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Theme.spacing.l, paddingVertical: Theme.spacing.m },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Theme.colors.surface.light, justifyContent: 'center', alignItems: 'center', ...Theme.shadows.light },
  headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: Theme.spacing.s },
  headerTitle: { ...Theme.typography.h3, color: Theme.colors.text.primaryLight, fontWeight: '700', textAlign: 'center' },
  listContent: { paddingHorizontal: Theme.spacing.l, paddingBottom: Theme.spacing.xxxl, paddingTop: Theme.spacing.s },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { ...Theme.typography.body1, color: Theme.colors.text.secondary },
});
