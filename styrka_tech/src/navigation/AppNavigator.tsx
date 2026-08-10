import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

import { navigationRef } from './navigationRef';
import { useAppState } from '../store/useAppState';
import LoginScreen from '../screens/LoginScreen';
import AdminDestinationScreen from '../screens/AdminDestinationScreen';
import AdminTrackingScreen from '../screens/AdminTrackingScreen';
import EmployeeDestinationScreen from '../screens/EmployeeDestinationScreen';
import EmployeeTrackingScreen from '../screens/EmployeeTrackingScreen';

const Tab = createBottomTabNavigator();

const HeaderRightLogout = () => {
  const { logout } = useAppState();
  return (
    <TouchableOpacity onPress={logout} style={{ marginRight: 15, padding: 5 }}>
      <Feather name="log-out" size={20} color="#EF4444" />
    </TouchableOpacity>
  );
};

const AdminTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: '#0F4C3A' },
        headerTitleStyle: { color: '#FFFFFF', fontWeight: 'bold' },
        headerRight: () => <HeaderRightLogout />,
        tabBarStyle: {
          backgroundColor: '#0F4C3A',
          borderTopWidth: 0,
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarIcon: ({ color }) => {
          let iconName: any = 'map-pin';
          if (route.name === 'Assign Destination') iconName = 'send';
          else if (route.name === 'Live Tracking') iconName = 'map';
          return <Feather name={iconName} size={22} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Assign Destination" component={AdminDestinationScreen} options={{ title: 'Assign Destination' }} />
      <Tab.Screen name="Live Tracking" component={AdminTrackingScreen} options={{ title: 'Live Employee Tracking' }} />
    </Tab.Navigator>
  );
};

const EmployeeTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: '#0F4C3A' },
        headerTitleStyle: { color: '#FFFFFF', fontWeight: 'bold' },
        headerRight: () => <HeaderRightLogout />,
        tabBarStyle: {
          backgroundColor: '#0F4C3A',
          borderTopWidth: 0,
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarIcon: ({ color }) => {
          let iconName: any = 'navigation';
          if (route.name === 'My Destinations') iconName = 'list';
          else if (route.name === 'LiveTracking') iconName = 'navigation';
          return <Feather name={iconName} size={22} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="My Destinations" component={EmployeeDestinationScreen} options={{ title: 'Assigned Destinations' }} />
      <Tab.Screen name="LiveTracking" component={EmployeeTrackingScreen} options={{ title: 'Start & Track Journey' }} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user, isAuthenticated, isLoading, checkSession } = useAppState();

  useEffect(() => {
    // Hide splash screen immediately on mount so APK never freezes on native splash screen
    SplashScreen.hideAsync().catch(() => {});
    checkSession();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F4C3A' }}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={{ color: 'white', marginTop: 15, fontWeight: 'bold' }}>Loading App...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {user.role === 'admin' ? <AdminTabs /> : <EmployeeTabs />}
    </NavigationContainer>
  );
};

export default AppNavigator;