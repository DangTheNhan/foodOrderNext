import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OrderHistoryScreen from '../screens/Order/OrderHistoryScreen';
import OrderDetailScreen from '../screens/Order/OrderDetailScreen';
import TrackOrderScreen from '../screens/Cart/TrackOrderScreen';
import { Theme } from '../theme';

const Stack = createNativeStackNavigator();

const OrderStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Theme.colors.background.light },
        headerTintColor: Theme.colors.text.primaryLight,
        headerTitleStyle: { ...Theme.typography.h3 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="OrderHistory"
        component={OrderHistoryScreen}
        options={{ title: 'Order History' }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: 'Order Details' }}
      />
      <Stack.Screen
        name="TrackOrder"
        component={TrackOrderScreen}
        options={{ title: 'Track Order', headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default OrderStackNavigator;
