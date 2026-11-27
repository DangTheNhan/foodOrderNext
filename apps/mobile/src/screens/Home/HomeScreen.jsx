import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { FoodService } from '../../services/FoodService';
import { ProfileService } from '../../services/ProfileService';
import { FoodCard } from '../../common/organisms/FoodCard';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [flashSaleTime, setFlashSaleTime] = useState(2 * 3600 + 15 * 60 + 30); // 2:15:30 in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setFlashSaleTime((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const [categories, setCategories] = useState([]);
  const [popularFoods, setPopularFoods] = useState([]);
  const [flashSaleFoods, setFlashSaleFoods] = useState([]);
  const [recommendedFoods, setRecommendedFoods] = useState([]);
  const [nearbyRestaurants, setNearbyRestaurants] = useState([]);
  const [categoryFoods, setCategoryFoods] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          cats,
          popular,
          flashSale,
          recommended,
          nearby,
        ] = await Promise.all([
          FoodService.getCategories(),
          FoodService.getPopularFoods(),
          FoodService.getFlashSaleFoods(),
          FoodService.getRecommendedFoods(),
          FoodService.getNearbyRestaurants(),
        ]);
        setCategories(cats);
        setPopularFoods(popular);
        setFlashSaleFoods(flashSale);
        setRecommendedFoods(recommended);
        setNearbyRestaurants(nearby);
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch home data. Please check your connection.');
        console.error('Failed to fetch home data', error);
      }
    };
    fetchData();
  }, []);

  // Fetch profile separately on focus so it updates immediately when coming back from Profile screen
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await ProfileService.getProfile();
        setUserProfile(profile);
      } catch (error) {
        console.error('Failed to fetch user profile', error);
      }
    };
    
    // Fetch once on mount
    fetchProfile();

    // And fetch every time the screen comes into focus
    const unsubscribe = navigation.addListener('focus', fetchProfile);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const fetchCategoryFoods = async () => {
      if (selectedCategory !== 'all') {
        try {
          const foods = await FoodService.searchFoods('', { category: selectedCategory, priceRange: 'all', rating: 0, deliveryTime: 'any' });
          setCategoryFoods(foods);
        } catch (error) {
          Alert.alert('Error', 'Failed to fetch category foods.');
          console.error('Failed to fetch category foods', error);
        }
      } else {
        setCategoryFoods([]);
      }
    };
    fetchCategoryFoods();
  }, [selectedCategory]);

  const handleFoodPress = (id) => {
    navigation.navigate('FoodDetail', { foodId: id });
  };

  const renderSectionHeader = (title, onSeeAll) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity activeOpacity={0.7} onPress={onSeeAll}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning,</Text>
          <Text style={styles.username}>{userProfile?.name || 'Welcome'}</Text>
        </View>
        <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8}>
          <Icon name="notifications-outline" size={24} color={Theme.colors.text.primaryLight} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Search Bar (Navigates to Search Screen) */}
        <TouchableOpacity 
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Search')}
        >
          <Icon name="search" size={22} color={Theme.colors.text.secondary} />
          <Text style={styles.searchText}>What are you craving today?</Text>
        </TouchableOpacity>

        {/* Promotion Banner */}
        <View style={styles.promoBanner}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>Special Offer</Text>
            <Text style={styles.promoDesc}>Get 50% off your first order!</Text>
            <TouchableOpacity style={styles.promoBtn} activeOpacity={0.8} onPress={() => navigation.navigate('FlashSale')}>
              <Text style={styles.promoBtnText}>Order Now</Text>
            </TouchableOpacity>
          </View>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }} 
            style={styles.promoImage} 
            resizeMode="cover"
          />
        </View>

        {/* Categories */}
        <View style={styles.section}>
          {renderSectionHeader('Categories', () => navigation.navigate('Menu'))}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listPadding, { paddingTop: 8 }]}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.categoryItem} 
                activeOpacity={0.8}
                onPress={() => {
                  if (item.id === 'all') {
                    navigation.navigate('Menu');
                  } else {
                    setSelectedCategory(prev => prev === item.id ? 'all' : item.id);
                  }
                }}
              >
                {selectedCategory === item.id && <View style={styles.categorySelectedRing} />}
                <View style={styles.categoryIconContainer}>
                  <Icon name={item.icon} size={28} color={Theme.colors.primary} />
                </View>
                <Text style={styles.categoryName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {selectedCategory !== 'all' && (() => {
          const catName = categories.find(c => c.id === selectedCategory)?.name || 'Foods';
          const title = catName.endsWith('s') ? catName : catName + 's';
          return (
            <View style={styles.section}>
              {renderSectionHeader(title, () => navigation.navigate('Menu'))}
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={categoryFoods}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listPadding}
                renderItem={({ item }) => (
                  <View style={{ width: 260 }}>
                    <FoodCard {...item} onPress={handleFoodPress} />
                  </View>
                )}
              />
            </View>
          );
        })()}

        {/* Flash Sale */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}><Icon name="flash" size={22} color="#FFD700" /> Flash Sale</Text>
            <Text style={styles.timerText}>{formatTime(flashSaleTime)}</Text>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={flashSaleFoods}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => (
              <View style={{ width: 260 }}>
                <FoodCard {...item} onPress={handleFoodPress} />
              </View>
            )}
          />
        </View>

        {/* Popular Foods */}
        <View style={styles.section}>
          {renderSectionHeader('Popular Now', () => navigation.navigate('PopularFoods'))}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={popularFoods}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => (
              <View style={{ width: 260 }}>
                <FoodCard {...item} onPress={handleFoodPress} />
              </View>
            )}
          />
        </View>

        {/* Recommended Foods */}
        <View style={styles.section}>
          {renderSectionHeader('Recommended For You', () => navigation.navigate('RecommendedFoods'))}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={recommendedFoods}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => (
              <View style={{ width: 260 }}>
                <FoodCard {...item} onPress={handleFoodPress} />
              </View>
            )}
          />
        </View>

        {/* Nearby Restaurants */}
        <View style={styles.section}>
          {renderSectionHeader('Nearby Restaurants', () => navigation.navigate('Restaurants'))}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={nearbyRestaurants}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.restaurantCard} 
                activeOpacity={0.9}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.restaurantImage} resizeMode="cover" />
                <View style={styles.restaurantInfo}>
                  <Text style={styles.restaurantName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.restaurantMeta}>
                    <Icon name="star" size={14} color="#FFD700" />
                    <Text style={styles.restaurantRating}>{item.rating}</Text>
                    <Icon name="location" size={12} color={Theme.colors.text.secondary} style={{ marginLeft: 12, marginRight: 4 }} />
                    <Text style={styles.restaurantDistance}>{item.distance}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Theme.colors.background.light 
  },
  scrollContent: {
    paddingBottom: Theme.spacing.xxxl,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: Theme.spacing.l,
    paddingTop: Theme.spacing.l,
    paddingBottom: Theme.spacing.m,
  },
  greeting: { 
    ...Theme.typography.body1, 
    color: Theme.colors.text.secondary,
    marginBottom: 4,
  },
  username: { 
    ...Theme.typography.h1, 
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
  },
  notificationBtn: { 
    padding: Theme.spacing.s,  
    borderRadius: Theme.radius.circle,
    ...Theme.shadows.light,
  },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Theme.colors.surface.light, 
    marginHorizontal: Theme.spacing.l, 
    paddingHorizontal: Theme.spacing.l, 
    height: 56, 
    borderRadius: Theme.radius.pill, 
    marginBottom: Theme.spacing.xl,
    ...Theme.shadows.medium,
  },
  searchText: { 
    ...Theme.typography.body1, 
    color: Theme.colors.text.secondary, 
    marginLeft: Theme.spacing.s,
    fontWeight: '500',
  },
  promoBanner: { 
    marginHorizontal: Theme.spacing.l, 
    backgroundColor: Theme.colors.primary, 
    borderRadius: 24, 
    flexDirection: 'row', 
    overflow: 'hidden', 
    marginBottom: Theme.spacing.xxl,
    ...Theme.shadows.medium,
  },
  promoContent: { 
    flex: 1, 
    padding: Theme.spacing.xl, 
    justifyContent: 'center' 
  },
  promoTitle: { 
    ...Theme.typography.h2, 
    color: Theme.colors.surface.light,
    fontWeight: '800',
  },
  promoDesc: { 
    ...Theme.typography.body2, 
    color: 'rgba(255,255,255,0.85)', 
    marginVertical: Theme.spacing.s,
    lineHeight: 20,
  },
  promoBtn: { 
    backgroundColor: Theme.colors.surface.light, 
    alignSelf: 'flex-start', 
    paddingHorizontal: Theme.spacing.l, 
    paddingVertical: Theme.spacing.s, 
    borderRadius: Theme.radius.pill, 
    marginTop: Theme.spacing.s 
  },
  promoBtnText: { 
    ...Theme.typography.button,
    color: Theme.colors.primary, 
  },
  promoImage: { 
    width: 140, 
    height: '100%', 
    backgroundColor: Theme.colors.border 
  },
  section: { 
    marginBottom: Theme.spacing.xxl,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    paddingHorizontal: Theme.spacing.l, 
    marginBottom: Theme.spacing.l 
  },
  sectionTitle: { 
    ...Theme.typography.h2, 
    color: Theme.colors.text.primaryLight,
    fontWeight: '700',
  },
  seeAll: { 
    ...Theme.typography.button, 
    color: Theme.colors.primary,
    marginBottom: 2,
  },
  timerText: { 
    ...Theme.typography.body1, 
    color: Theme.colors.feedback.error, 
    fontWeight: '800',
    marginBottom: 2,
  },
  listPadding: { 
    paddingHorizontal: Theme.spacing.l,
    paddingBottom: Theme.spacing.m, // Room for shadows
  },
  categoryItem: { 
    alignItems: 'center', 
    marginRight: Theme.spacing.xl 
  },
  categorySelectedRing: {
    position: 'absolute',
    top: -6,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.primary + '15',
  },
  categoryIconContainer: { 
    width: 68, 
    height: 68, 
    borderRadius: 34, 
    backgroundColor: Theme.colors.surface.light, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: Theme.spacing.s, 
    ...Theme.shadows.medium,
  },
  categoryName: { 
    ...Theme.typography.body2, 
    color: Theme.colors.text.primaryLight,
    fontWeight: '600',
  },
  restaurantCard: { 
    width: 260, 
    backgroundColor: Theme.colors.surface.light, 
    borderRadius: 20, 
    marginRight: Theme.spacing.xl, 
    overflow: 'hidden', 
    ...Theme.shadows.medium,
  },
  restaurantImage: { 
    width: '100%', 
    height: 140, 
    backgroundColor: Theme.colors.border 
  },
  restaurantInfo: { 
    padding: Theme.spacing.l 
  },
  restaurantName: { 
    ...Theme.typography.h3, 
    color: Theme.colors.text.primaryLight, 
    marginBottom: 6 
  },
  restaurantMeta: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  restaurantRating: { 
    ...Theme.typography.body2, 
    color: Theme.colors.text.primaryLight, 
    fontWeight: '700',
    marginLeft: 4 
  },
  restaurantDistance: { 
    ...Theme.typography.body2, 
    color: Theme.colors.text.secondary, 
  },
});
