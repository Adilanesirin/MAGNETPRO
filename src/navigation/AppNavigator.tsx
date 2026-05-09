import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FeesScreen } from '../screens/FeesScreen';
import { PaymentScreen } from '../screens/paymentScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Home"  component={HomeScreen} />
      <Stack.Screen name="Fees" component={FeesScreen} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);