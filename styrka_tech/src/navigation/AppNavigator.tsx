import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import EmployeeDashboard from '../screens/EmployeeDashboard';
import AdminDashboard from '../screens/AdminDashboard';
import LoginScreen from '../screens/LoginScreen';
import MoreOptionsModal from '../components/MoreOptionsModal';
import AddEmployeeScreen from '../screens/AddEmployeeScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import OrdersScreen from '../screens/OrdersScreen';
import EmployeeDirectoryScreen from '../screens/EmployeeDirectoryScreen';
import EmployeeProfileScreen from '../screens/EmployeeProfileScreen';
import LeaveRequestsScreen from '../screens/LeaveRequestsScreen';
import AssignTaskScreen from '../screens/AssignTaskScreen';
import ChatScreen from '../screens/ChatScreen';
import EmployeeChatScreen from '../screens/EmployeeChatScreen';
import EmployeeAttendanceScreen from '../screens/EmployeeAttendanceScreen';
import EmployeeLeaveScreen from '../screens/EmployeeLeaveScreen';
import EmployeeFarmersScreen from '../screens/EmployeeFarmersScreen';
import EmployeeDealersScreen from '../screens/EmployeeDealersScreen';
import FarmersScreen from '../screens/FarmersScreen';
import DealersScreen from '../screens/DealersScreen';
import EmployeeTrackingScreen from '../screens/EmployeeTrackingScreen';
import AdminTrackingScreen from '../screens/AdminTrackingScreen';
import LogDeliveryScreen from '../screens/LogDeliveryScreen';

const Tab = createBottomTabNavigator();

const DummyScreen = ({ title }: { title?: string }) => (
  <View className="flex-1 justify-center items-center bg-[#F3F4F6]">
    <Text className="text-2xl font-bold text-[#111827]">{title || 'Coming Soon'}</Text>
  </View>
);

const AdminTabs = () => {
  const { setMoreModalVisible } = useAppState();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F4C3A', // Dark green matching design
          borderTopWidth: 0,
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#F59E0B', // Orange
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any = 'square';
          let finalColor = color;

          if (route.name === 'Overview') iconName = 'grid';
          else if (route.name === 'Attendance') iconName = 'calendar';
          else if (route.name === 'Orders') iconName = 'shopping-cart';
          else if (route.name === 'Employee' || route.name === 'EmployeeProfile') {
            iconName = 'users';
            if (route.name === 'EmployeeProfile') {
              finalColor = '#F59E0B'; // Keep it orange when in sub-screen
            }
          }
          else if (route.name === 'More' || route.name === 'AddEmployee' || route.name === 'LeaveRequests' || route.name === 'AssignTask' || route.name === 'Chat' || route.name === 'Farmers' || route.name === 'Dealers') {
            iconName = 'menu';
            // Force the More icon to be active if we're on a sub-screen
            if (route.name === 'AddEmployee' || route.name === 'LeaveRequests' || route.name === 'AssignTask' || route.name === 'Chat' || route.name === 'Farmers' || route.name === 'Dealers') {
              finalColor = '#F59E0B'; 
            }
          }

          return <Feather name={iconName} size={22} color={finalColor} />;
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="Overview" component={AdminDashboard} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Employee" component={EmployeeDirectoryScreen} />
      <Tab.Screen 
        name="EmployeeProfile" 
        component={EmployeeProfileScreen} 
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen 
        name="LeaveRequests" 
        component={LeaveRequestsScreen} 
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen 
        name="AssignTask" 
        component={AssignTaskScreen} 
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen 
        name="More" 
        children={() => <DummyScreen title="More" />} 
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            setMoreModalVisible(true);
          },
        }}
      />
      <Tab.Screen 
        name="AddEmployee" 
        component={AddEmployeeScreen}
        options={{ tabBarButton: () => null }} // Hide from the actual tab bar
      />
      <Tab.Screen 
        name="Farmers" 
        component={FarmersScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen 
        name="Dealers" 
        component={DealersScreen}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
};

const EmployeeTabs = () => {
  const { setMoreModalVisible } = useAppState();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F4C3A',
          borderTopWidth: 0,
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarIcon: ({ color, size }) => {
          let iconName: any = 'square';
          if (route.name === 'Overview') iconName = 'grid';
          else if (route.name === 'My Farmers') iconName = 'users';
          else if (route.name === 'More' || route.name === 'Attendance' || route.name === 'Leave' || route.name === 'Log Delivery' || route.name === 'LiveTracking' || route.name === 'My Dealers' || route.name === 'Chat') {
            iconName = 'menu';
          }
          
          return <Feather name={iconName} size={22} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="Overview" component={EmployeeDashboard} />
      <Tab.Screen name="My Farmers" component={EmployeeFarmersScreen} />
      <Tab.Screen 
        name="Attendance" 
        component={EmployeeAttendanceScreen} 
        options={{ tabBarButton: () => null }} 
      />
      <Tab.Screen 
        name="Leave" 
        component={EmployeeLeaveScreen} 
        options={{ tabBarButton: () => null }} 
      />
      <Tab.Screen 
        name="Log Delivery" 
        component={LogDeliveryScreen} 
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen 
        name="LiveTracking" 
        component={EmployeeTrackingScreen} 
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen 
        name="My Dealers" 
        component={EmployeeDealersScreen} 
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen 
        name="Chat" 
        component={EmployeeChatScreen} 
        options={{ tabBarButton: () => null }} 
      />
      <Tab.Screen 
        name="More" 
        component={DummyScreen} 
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            setMoreModalVisible(true);
          },
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user, isAuthenticated, isLoading, checkSession } = useAppState();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F3F4F6]">
        <ActivityIndicator size="large" color="#145C44" />
        <Text className="text-[#333333] mt-4 font-medium">Loading Application...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      {user.role === 'admin' ? <AdminTabs /> : <EmployeeTabs />}
      <MoreOptionsModal />
    </NavigationContainer>
  );
};

export default AppNavigator;