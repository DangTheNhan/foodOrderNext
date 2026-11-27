import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/Home/HomeScreen';
import SearchScreen from '../screens/Home/SearchScreen';
import FilterScreen from '../screens/Home/FilterScreen';
import FoodDetailScreen from '../screens/Home/FoodDetailScreen';
import MenuScreen from '../screens/Home/MenuScreen';
import PopularFoodsScreen from '../screens/Home/PopularFoodsScreen';
import RecommendedFoodsScreen from '../screens/Home/RecommendedFoodsScreen';
import RestaurantsScreen from '../screens/Home/RestaurantsScreen';
import RestaurantDetailScreen from '../screens/Home/RestaurantDetailScreen';
import FlashSaleScreen from '../screens/Home/FlashSaleScreen';
import { Theme } from '../theme';

const Stack = createNativeStackNavigator();

const HomeStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain"   component={HomeScreen} />
      <Stack.Screen name="Search"     component={SearchScreen} />
      <Stack.Screen
        name="Filter"
        component={FilterScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Filters', headerStyle: { backgroundColor: Theme.colors.background.light }, headerTintColor: Theme.colors.text.primaryLight, headerTitleStyle: { ...Theme.typography.h3 }, headerShadowVisible: false }}
      />
      <Stack.Screen name="FoodDetail" component={FoodDetailScreen} />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="PopularFoods" component={PopularFoodsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FlashSale" component={FlashSaleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RecommendedFoods" component={RecommendedFoodsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Restaurants" component={RestaurantsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;
