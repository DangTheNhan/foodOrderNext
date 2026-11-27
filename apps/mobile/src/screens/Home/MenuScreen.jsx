import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SearchBar } from '../../common/atoms/SearchBar';
import { FoodCard } from '../../common/organisms/FoodCard';
import { Theme } from '../../theme';
import { FoodService } from '../../services/FoodService';

export default function MenuScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [categories, setCategories] = useState([]);
  const [foods, setFoods] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await FoodService.getCategories();
        setCategories(cats);
      } catch (error) {
        console.error(error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchFoods = async () => {
      try {
        const results = await FoodService.searchFoods(query, {
          category: selectedCategory,
          priceRange: 'all',
          rating: 0,
          deliveryTime: 'any'
        });
        setFoods(results);
      } catch (error) {
        console.error(error);
      }
    };
    
    const timer = setTimeout(() => {
      fetchFoods();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, selectedCategory]);

  const handleFoodPress = (id) => {
    navigation.navigate('FoodDetail', { foodId: id });
  };

  const renderCategoryChip = ({ item }) => {
    const isActive = selectedCategory === item.id;
    return (
      <TouchableOpacity
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => setSelectedCategory(item.id)}
        activeOpacity={0.8}
      >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Icon name="arrow-back" size={28} color={Theme.colors.text.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Full Menu</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search all foods..."
        />
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderCategoryChip}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Food List */}
      <FlatList
        data={foods}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.foodList}
        onScroll={() => Keyboard.dismiss()}
        renderItem={({ item }) => (
          <View style={styles.foodCardWrapper}>
            <FoodCard {...item} onPress={handleFoodPress} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="restaurant-outline" size={64} color={Theme.colors.border} />
            <Text style={styles.emptyText}>No foods found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.l,
    paddingTop: Theme.spacing.m,
    paddingBottom: Theme.spacing.s,
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
    ...Theme.typography.h2,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
  },
  searchWrapper: {
    paddingHorizontal: Theme.spacing.l,
    paddingTop: Theme.spacing.m,
  },
  categoriesWrapper: {
    marginBottom: Theme.spacing.m,
  },
  categoriesList: {
    paddingHorizontal: Theme.spacing.l,
    gap: Theme.spacing.m,
  },
  chip: {
    paddingHorizontal: Theme.spacing.l,
    paddingVertical: 10,
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.pill,
    ...Theme.shadows.light,
  },
  chipActive: {
    backgroundColor: Theme.colors.primary,
  },
  chipText: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Theme.colors.surface.light,
  },
  foodList: {
    paddingHorizontal: Theme.spacing.l,
    paddingBottom: Theme.spacing.xxxl,
  },
  foodCardWrapper: {
    marginBottom: Theme.spacing.l,
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    marginTop: Theme.spacing.m,
  },
});
