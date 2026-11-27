import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CartScreen from '../screens/Cart/CartScreen';
import CheckoutScreen from '../screens/Cart/CheckoutScreen';
import PaymentScreen from '../screens/Cart/PaymentScreen';
import OrderSuccessScreen from '../screens/Cart/OrderSuccessScreen';
import TrackOrderScreen from '../screens/Cart/TrackOrderScreen';
import { Theme } from '../theme';

const Stack = createNativeStackNavigator();

const CartStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Theme.colors.background.light },
        headerTintColor: Theme.colors.text.primaryLight,
        headerTitleStyle: { ...Theme.typography.h3 },
        headerShadowVisible: false,
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="CartMain"
        component={CartScreen}
        options={{ title: 'My Cart' }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: 'Checkout', headerShown: false }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ title: 'Payment', headerShown: false }}
      />
      <Stack.Screen
        name="OrderSuccess"
        component={OrderSuccessScreen}
        options={{ title: 'Order Confirmed', headerShown: false }}
      />
      <Stack.Screen
        name="TrackOrder"
        component={TrackOrderScreen}
        options={{ title: 'Track Order', headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default CartStackNavigator;
