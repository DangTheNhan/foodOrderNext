import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { FoodService } from '../../services/FoodService';
import { useCartStore } from '../../stores/cartStore';
import { useFavoriteStore } from '../../stores/favoriteStore';

const { width } = Dimensions.get('window');

export default function FoodDetailScreen({ route, navigation }) {
  const { foodId } = route.params;
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  
  const [quantity, setQuantity] = useState(1);
  const addToCart = useCartStore(state => state.addToCart);
  const { addFavorite, removeFavorite, isFavorite } = useFavoriteStore();

  useEffect(() => {
    const fetchFood = async () => {
      try {
        const data = await FoodService.getFoodById(foodId);
        setFood(data);
      } catch (error) {
        console.error('Failed to fetch food detail', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFood();
  }, [foodId]);

  if (loading) {
    return (
      <View style={styles.errorContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!food) {
    return (
      <View style={styles.errorContainer}>
        <Text>Food not found!</Text>
      </View>
    );
  }

  const favorite = isFavorite(food.id);

  const handleFavoriteToggle = () => {
    if (favorite) removeFavorite(food.id);
    else addFavorite(food);
  };

  const handleAddToCart = () => {
    addToCart(food, quantity);
    navigation.navigate('Cart');
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Immersive Hero Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: food.imageUrl }} style={styles.image} resizeMode="cover" />
          
          {/* Floating Header */}
          <View style={[styles.headerOverlay, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Icon name="chevron-back" size={28} color={Theme.colors.text.primaryLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleFavoriteToggle} activeOpacity={0.8}>
              <Icon name={favorite ? "heart" : "heart-outline"} size={26} color={favorite ? Theme.colors.feedback.error : Theme.colors.text.primaryLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Sheet (Overlaps the image) */}
        <View style={styles.contentSheet}>
          
          {/* Header Row */}
          <View style={styles.titleRow}>
            <Text style={styles.name}>{food.name}</Text>
            <Text style={styles.price}>${food.price.toFixed(2)}</Text>
          </View>

          {/* Meta Pills */}
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Icon name="star" size={18} color="#FFD700" />
              <Text style={styles.metaText}>{food.rating} Rating</Text>
            </View>
            <View style={styles.metaPill}>
              <Icon name="time-outline" size={18} color={Theme.colors.primary} />
              <Text style={styles.metaText}>{food.deliveryTime || '25-30 min'}</Text>
            </View>
          </View>

          {/* Description Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{food.description}</Text>
          </View>

          {/* Ingredients Card */}
          {food.ingredients && food.ingredients.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.ingredientsGroup}>
                {food.ingredients.map((ing, idx) => (
                  <View key={idx} style={styles.ingredientChip}>
                    <Text style={styles.ingredientText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) }]}>
        
        <View style={styles.quantityContainer}>
          <TouchableOpacity 
            style={styles.qtyBtn} 
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            activeOpacity={0.7}
          >
            <Icon name="remove" size={24} color={Theme.colors.text.primaryLight} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity 
            style={styles.qtyBtn}
            onPress={() => setQuantity(quantity + 1)}
            activeOpacity={0.7}
          >
            <Icon name="add" size={24} color={Theme.colors.text.primaryLight} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart} activeOpacity={0.8}>
          <Text style={styles.addToCartLabel}>Add to Cart</Text>
          <View style={styles.addToCartPriceBox}>
            <Text style={styles.addToCartPrice}>${(food.price * quantity).toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Theme.colors.background.light 
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  scrollContent: {
    paddingBottom: 140, // Space for the bottom bar
  },

  // Hero Section
  imageContainer: { 
    width: '100%', 
    height: width, // Square immersive image
    position: 'relative' 
  },
  image: { 
    width: '100%', 
    height: '100%' 
  },
  headerOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    paddingHorizontal: Theme.spacing.l,
    flexDirection: 'row', 
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconBtn: { 
    width: 52,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.95)', 
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },

  // Overlapping Content Sheet
  contentSheet: {
    marginTop: -40,
    backgroundColor: Theme.colors.background.light,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.l,
  },
  titleRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: Theme.spacing.m 
  },
  name: { 
    ...Theme.typography.h1, 
    color: Theme.colors.text.primaryLight, 
    flex: 1, 
    marginRight: Theme.spacing.m,
    fontWeight: '800',
    lineHeight: 36,
  },
  price: { 
    ...Theme.typography.h1, 
    color: Theme.colors.primary,
    fontWeight: '800',
  },

  // Meta Pills
  metaRow: { 
    flexDirection: 'row', 
    marginBottom: Theme.spacing.xl 
  },
  metaPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Theme.colors.surface.light,
    paddingHorizontal: Theme.spacing.m,
    paddingVertical: Theme.spacing.s,
    borderRadius: Theme.radius.pill,
    marginRight: Theme.spacing.m,
    ...Theme.shadows.light,
  },
  metaText: { 
    ...Theme.typography.body1, 
    color: Theme.colors.text.primaryLight, 
    marginLeft: 6,
    fontWeight: '600',
  },

  // Premium Cards
  card: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: 24,
    padding: Theme.spacing.l,
    marginBottom: Theme.spacing.l,
    ...Theme.shadows.light,
  },
  sectionTitle: { 
    ...Theme.typography.h2, 
    color: Theme.colors.text.primaryLight, 
    marginBottom: Theme.spacing.m,
    fontWeight: '700',
  },
  description: { 
    ...Theme.typography.body1, 
    color: Theme.colors.text.secondary, 
    lineHeight: 26, 
  },
  
  // Ingredients
  ingredientsGroup: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: Theme.spacing.m 
  },
  ingredientChip: { 
    backgroundColor: Theme.colors.background.light, 
    paddingHorizontal: Theme.spacing.l, 
    paddingVertical: 10, 
    borderRadius: Theme.radius.pill, 
  },
  ingredientText: { 
    ...Theme.typography.body2, 
    color: Theme.colors.text.primaryLight,
    fontWeight: '500',
  },

  // Sticky Bottom Bar
  bottomBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: Theme.colors.surface.light, 
    paddingHorizontal: Theme.spacing.l, 
    paddingTop: Theme.spacing.l,
    flexDirection: 'row', 
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...Theme.shadows.large,
  },
  quantityContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Theme.colors.background.light, 
    borderRadius: Theme.radius.pill, 
    paddingHorizontal: 6,
    marginRight: Theme.spacing.l,
  },
  qtyBtn: { 
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface.light,
    borderRadius: 22,
    ...Theme.shadows.light,
    margin: 4,
  },
  qtyText: { 
    ...Theme.typography.h2, 
    paddingHorizontal: Theme.spacing.m,
    fontWeight: '700',
  },
  addToCartBtn: { 
    flex: 1, 
    backgroundColor: Theme.colors.primary, 
    borderRadius: Theme.radius.pill, 
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingLeft: Theme.spacing.xl,
    paddingRight: 6,
    paddingVertical: 6,
  },
  addToCartLabel: { 
    ...Theme.typography.button, 
    color: Theme.colors.surface.light,

  },
  addToCartPriceBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Theme.spacing.m,
    paddingVertical: 12,
    borderRadius: Theme.radius.pill,
  },
  addToCartPrice: {
    ...Theme.typography.button, 
    color: Theme.colors.surface.light,
  }
});
