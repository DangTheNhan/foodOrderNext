import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { PriceTag } from '../atoms/PriceTag';
import { useFavoriteStore } from '../../stores/favoriteStore';

export const FoodCard = ({
  id,
  name,
  description,
  price,
  originalPrice,
  imageUrl,
  rating,
  onPress,
}) => {
  const { isFavorite, addFavorite, removeFavorite } = useFavoriteStore();
  const favorite = isFavorite(id);

  const toggleFavorite = (e) => {
    // Prevent navigating to detail screen when clicking favorite
    // NOTE: in React Native, wrapping Icon in TouchableOpacity already intercepts the tap, but we might need e.stopPropagation on Web if applicable.
    if (favorite) {
      removeFavorite(id);
    } else {
      addFavorite({ id, name, description, price, imageUrl, rating });
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(id)}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        <TouchableOpacity style={styles.favoriteBtn} onPress={toggleFavorite}>
          <Icon name={favorite ? "heart" : "heart-outline"} size={20} color={favorite ? Theme.colors.feedback.error : Theme.colors.text.primaryLight} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
        <View style={styles.footer}>
          <PriceTag price={price} originalPrice={originalPrice} />
          {rating && (
            <View style={styles.ratingContainer}>
              <Icon name="star" size={12} color="#FFD700" style={styles.starIcon} />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    ...Theme.shadows.medium,
    overflow: 'hidden',
    marginBottom: Theme.spacing.l,
    marginHorizontal: Theme.spacing.m,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: Theme.colors.border,
  },
  favoriteBtn: {
    position: 'absolute',
    top: Theme.spacing.m,
    right: Theme.spacing.m,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.light,
  },
  content: {
    padding: Theme.spacing.l,
  },
  name: {
    ...Theme.typography.h3,
    fontWeight: '700',
    color: Theme.colors.text.primaryLight,
    marginBottom: Theme.spacing.xs,
  },
  description: {
    ...Theme.typography.body2,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.m,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.light,
    paddingHorizontal: Theme.spacing.s,
    paddingVertical: 4,
    borderRadius: Theme.radius.pill,
  },
  starIcon: {
    marginRight: 2,
  },
  ratingText: {
    ...Theme.typography.caption,
    fontWeight: '700',
    color: Theme.colors.text.primaryLight,
  },
});
