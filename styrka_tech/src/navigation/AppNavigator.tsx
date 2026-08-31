import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

import { navigationRef } from './navigationRef';
import { useAppState } from '../store/useAppState';
import LoginScreen from '../screens/LoginScreen';
import AdminTrackingScreen from '../screens/AdminTrackingScreen';
import AdminEmployeesScreen from '../screens/AdminEmployeesScreen';
import AdminJourneyLogsScreen from '../screens/AdminJourneyLogsScreen';
import EmployeeDestinationScreen from '../screens/EmployeeDestinationScreen';
import EmployeeTrackingScreen from '../screens/EmployeeTrackingScreen';

const Tab = createBottomTabNavigator();

const HeaderRightLogout = () => {
  const { logout } = useAppState();
  return (
    <TouchableOpacity 
      onPress={logout} 
      style={{ 
        marginRight: 16, 
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.16)', 
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.38)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <Feather name="log-out" size={15} color="#F87171" style={{ marginRight: 5 }} />
      <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>Exit</Text>
    </TouchableOpacity>
  );
};

const AdminTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { 
          backgroundColor: '#0F4C3A',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
        },
        headerTitleStyle: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
        headerRight: () => <HeaderRightLogout />,
        tabBarStyle: {
          backgroundColor: 'rgba(15, 76, 58, 0.96)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.12)',
          height: 68,
          paddingBottom: 10,
          paddingTop: 10,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: 'rgba(156, 163, 175, 0.75)',
        tabBarIcon: ({ color, focused }) => {
          let iconName: any = 'map';
          if (route.name === 'Manage Employees') iconName = 'users';
          else if (route.name === 'Live Tracking') iconName = 'map';
          else if (route.name === 'Journey Logs') iconName = 'calendar';
          return (
            <View style={focused ? {
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.3)',
            } : {}}>
              <Feather name={iconName} size={20} color={color} />
            </View>
          );
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Live Tracking" component={AdminTrackingScreen} options={{ title: 'Live Employee Tracking' }} />
      <Tab.Screen name="Journey Logs" component={AdminJourneyLogsScreen} options={{ title: 'Journey Logs & History' }} />
      <Tab.Screen name="Manage Employees" component={AdminEmployeesScreen} options={{ title: 'Employees' }} />
    </Tab.Navigator>
  );
};

const EmployeeTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { 
          backgroundColor: '#0F4C3A',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
        },
        headerTitleStyle: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
        headerRight: () => <HeaderRightLogout />,
        tabBarStyle: {
          backgroundColor: 'rgba(15, 76, 58, 0.96)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.12)',
          height: 68,
          paddingBottom: 10,
          paddingTop: 10,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: 'rgba(156, 163, 175, 0.75)',
        tabBarIcon: ({ color, focused }) => {
          let iconName: any = 'navigation';
          if (route.name === 'Select Destination') iconName = 'map-pin';
          else if (route.name === 'LiveTracking') iconName = 'navigation';
          return (
            <View style={focused ? {
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.3)',
            } : {}}>
              <Feather name={iconName} size={20} color={color} />
            </View>
          );
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Select Destination" component={EmployeeDestinationScreen} options={{ title: 'Select Destination' }} />
      <Tab.Screen name="LiveTracking" component={EmployeeTrackingScreen} options={{ title: 'Start & Track Journey' }} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user, isAuthenticated, isLoading, checkSession } = useAppState();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    checkSession();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F4C3A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const ADMIN_EMAILS = [
    'manthanpandhare1110@gmail.com',
    'pravindagade007@gmail.com',
    'rustumsayyed905@gmail.com',
    'admin_1',
    'admin_2',
    'admin_3'
  ];

  const cleanEmail = (user.email || '').trim().toLowerCase();
  const cleanId = String(user.id || '').trim().toLowerCase();
  const isAdmin = user.role === 'admin' || ADMIN_EMAILS.includes(cleanEmail) || cleanId.startsWith('admin');

  return (
    <NavigationContainer ref={navigationRef}>
      {isAdmin ? <AdminTabs /> : <EmployeeTabs />}
    </NavigationContainer>
  );
};

export default AppNavigator;