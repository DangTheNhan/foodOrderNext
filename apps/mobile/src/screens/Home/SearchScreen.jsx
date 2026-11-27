import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SearchBar } from '../../common/atoms/SearchBar';
import { FoodCard } from '../../common/organisms/FoodCard';
import { Theme } from '../../theme';
import { FoodService } from '../../services/FoodService';
import { useFilterStore } from '../../stores/filterStore';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const filters = useFilterStore(state => state.filters);

  useEffect(() => {
    // Live filtering
    const fetchData = async () => {
      try {
        const data = await FoodService.searchFoods(query, filters);
        setResults(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchData();
  }, [query, filters]);

  const handleFoodPress = (id) => {
    navigation.navigate('FoodDetail', { foodId: id });
  };

  const handleScroll = () => {
    Keyboard.dismiss();
  };

  const recentSearches = ['Burger', 'Pizza', 'Coffee'];
  const popularKeywords = ['KFC', 'Sushi', 'Dessert', 'Healthy'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Icon name="arrow-back" size={28} color={Theme.colors.text.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.searchWrapper}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Find your next meal..."
          onFilterPress={() => navigation.navigate('Filter')}
        />
      </View>

      {!query && filters.category === 'all' && filters.priceRange === 'all' && filters.rating === 0 ? (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.sectionTitle}>Recent Searches</Text>
          <View style={styles.chipGroup}>
            {recentSearches.map(item => (
              <TouchableOpacity key={item} style={styles.chip} onPress={() => setQuery(item)} activeOpacity={0.8}>
                <Icon name="time-outline" size={18} color={Theme.colors.text.secondary} />
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: Theme.spacing.xxl }]}>Popular Keywords</Text>
          <View style={styles.chipGroup}>
            {popularKeywords.map(item => (
              <TouchableOpacity key={item} style={styles.chip} onPress={() => setQuery(item)} activeOpacity={0.8}>
                <Icon name="trending-up-outline" size={18} color={Theme.colors.text.secondary} />
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <FoodCard {...item} onPress={handleFoodPress} />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Icon name="search-outline" size={56} color={Theme.colors.primary} />
              </View>
              <Text style={styles.emptyText}>No matches found</Text>
              <Text style={styles.emptySubText}>Try a different keyword or adjust your filters.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Theme.colors.background.light 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: Theme.spacing.l,
    paddingTop: Theme.spacing.m,
    paddingBottom: Theme.spacing.l,
  },
  headerTitle: { 
    ...Theme.typography.h2, 
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
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
  searchWrapper: { 
    paddingHorizontal: Theme.spacing.l, 
    zIndex: 10,
  },
  suggestionsContainer: { 
    paddingHorizontal: Theme.spacing.l, 
    paddingTop: Theme.spacing.m 
  },
  sectionTitle: { 
    ...Theme.typography.h2, 
    color: Theme.colors.text.primaryLight, 
    marginBottom: Theme.spacing.l,
    fontWeight: '700',
  },
  chipGroup: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: Theme.spacing.m 
  },
  chip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Theme.colors.surface.light, 
    paddingHorizontal: Theme.spacing.l, 
    paddingVertical: 12, 
    borderRadius: Theme.radius.pill, 
    ...Theme.shadows.light,
  },
  chipText: { 
    ...Theme.typography.body1, 
    color: Theme.colors.text.primaryLight, 
    marginLeft: Theme.spacing.s,
    fontWeight: '600',
  },
  listContent: { 
    paddingBottom: Theme.spacing.xxxl, 
    paddingTop: Theme.spacing.s,
  },
  cardWrapper: {
    marginBottom: Theme.spacing.l,
  },
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: Theme.spacing.xl, 
    marginTop: 80 
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  emptyText: { 
    ...Theme.typography.h1, 
    color: Theme.colors.text.primaryLight, 
    marginBottom: Theme.spacing.s,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubText: { 
    ...Theme.typography.body1, 
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Theme.spacing.l,
  },
});
