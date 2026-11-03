import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FeesScreen } from '../screens/FeesScreen';
import { PaymentScreen } from '../screens/paymentScreen';
import { AttendanceScreen } from '../screens/AttendanceScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DiaryScreen } from '../screens/DiaryScreen';
import {LibraryScreen} from '../screens/LibraryScreen';
import ProgressCardScreen from '../screens/ProgressCardScreen';
import { AcademicCalendarScreen } from '../screens/AcademicCalendarScreen';
import { AIChatbotScreen } from '../screens/AIChatbotScreen';
import { EnglishTutorScreen } from '../screens/Englishtutorscreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Home"  component={HomeScreen} />
      <Stack.Screen name="Fees" component={FeesScreen} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Diary" component={DiaryScreen} />
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="ProgressCard" component={ProgressCardScreen} />
      <Stack.Screen name="AcademicCalendar" component={AcademicCalendarScreen} />
      <Stack.Screen name="AIChatbot" component={AIChatbotScreen} />
      <Stack.Screen name="EnglishTutor" component={EnglishTutorScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />

    </Stack.Navigator>
    
  </NavigationContainer>
);