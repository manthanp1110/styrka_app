import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { supabase } from '../config/supabase';

const QuickActionButton = ({ title, iconName, bgColor, onPress }: { title: string, iconName: any, bgColor: string, onPress?: () => void }) => (
  <TouchableOpacity onPress={onPress} className={`flex-row items-center px-4 py-3 rounded-xl m-1 ${bgColor}`}>
    <Feather name={iconName} size={18} color="white" />
    <Text className="text-white font-bold ml-2">{title}</Text>
  </TouchableOpacity>
);

const AdminDashboard = () => {
  const { logout, user } = useAppState();
  const navigation = useNavigation<NavigationProp<any>>();
  const [stats, setStats] = useState({ employees: 0, pendingTasks: 0, completedTasks: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [empRes, pendingTaskRes, completedTaskRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }).eq('role', 'employee'),
        supabase.from('tasks').select('id', { count: 'exact' }).neq('status', 'Completed'),
        supabase.from('tasks').select('id', { count: 'exact' }).eq('status', 'Completed'),
      ]);

      setStats({
        employees: empRes.count || 0,
        pendingTasks: pendingTaskRes.count || 0,
        completedTasks: completedTaskRes.count || 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Custom Header */}
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-[#F59E0B] items-center justify-center shadow-sm border border-[#D97706]">
            <Text className="text-white font-bold text-lg">{user.name?.charAt(0) || 'A'}</Text>
          </View>
          <View className="ml-3">
            <Text className="text-white font-bold text-lg leading-tight">STYRKA</Text>
            <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest">ADMIN PANEL</Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <TouchableOpacity onPress={logout} className="w-10 h-10 rounded-xl bg-[#1A634E] items-center justify-center border border-[#144F3D]">
            <Feather name="log-out" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Scroll */}
      <ScrollView 
        style={{ flex: 1, backgroundColor: '#F4F7FB' }}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Overview Section */}
        <View className="px-5 pt-6">
          <Text className="text-2xl font-bold text-[#1F2937] mb-4">Overview</Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color="#0F4C3A" className="my-10" />
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {/* Total Employees */}
              <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm shadow-gray-200 border border-gray-100" style={{ width: '48%' }}>
                <View className="flex-row items-start justify-between">
                  <View className="w-12 h-12 rounded-2xl bg-blue-100 items-center justify-center">
                    <Feather name="users" size={20} color="#3B82F6" />
                  </View>
                  <View className="items-end flex-1 pl-2">
                    <Text className="text-[11px] font-bold text-gray-500 uppercase text-right">Total Employees</Text>
                    <Text className="text-3xl font-extrabold text-[#1F2937] mt-1">{stats.employees}</Text>
                  </View>
                </View>
              </View>

              {/* Pending Tasks */}
              <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm shadow-gray-200 border border-gray-100" style={{ width: '48%' }}>
                <View className="flex-row items-start justify-between">
                  <View className="w-12 h-12 rounded-2xl bg-amber-100 items-center justify-center">
                    <Feather name="check-square" size={20} color="#D97706" />
                  </View>
                  <View className="items-end flex-1 pl-2">
                    <Text className="text-[11px] font-bold text-gray-500 uppercase text-right">Pending Tasks</Text>
                    <Text className="text-3xl font-extrabold text-[#1F2937] mt-1">{stats.pendingTasks}</Text>
                  </View>
                </View>
              </View>

              {/* Completed Tasks */}
              <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm shadow-gray-200 border border-gray-100" style={{ width: '48%' }}>
                <View className="flex-row items-start justify-between">
                  <View className="w-12 h-12 rounded-2xl bg-emerald-100 items-center justify-center">
                    <Feather name="file-text" size={20} color="#059669" />
                  </View>
                  <View className="items-end flex-1 pl-2">
                    <Text className="text-[11px] font-bold text-gray-500 uppercase text-right">Completed Tasks</Text>
                    <Text className="text-3xl font-extrabold text-[#1F2937] mt-1">{stats.completedTasks}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View className="px-5 mt-4">
          <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-100 overflow-hidden">
            <View className="p-5 border-b border-gray-100">
              <Text className="text-xl font-bold text-[#1F2937]">Quick Actions</Text>
            </View>
            <View className="p-4 flex-row flex-wrap">
              <QuickActionButton 
                title="Add Employee" 
                iconName="user-plus" 
                bgColor="bg-emerald-600" 
                onPress={() => navigation.navigate('AddEmployee')} 
              />
              <QuickActionButton title="View Farmers" iconName="users" bgColor="bg-[#059669]" onPress={() => navigation.navigate('Farmers')} />
              <QuickActionButton title="View Dealers" iconName="home" bgColor="bg-[#059669]" onPress={() => navigation.navigate('Dealers')} />
              <QuickActionButton title="Assign Task" iconName="check-square" bgColor="bg-[#F59E0B]" onPress={() => navigation.navigate('AssignTask')} />
              <QuickActionButton title="Live Tracking" iconName="map" bgColor="bg-emerald-600" onPress={() => navigation.navigate('AdminTracking')} />
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminDashboard;
