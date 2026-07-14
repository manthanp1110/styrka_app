import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';

const QuickActionButton = ({ title, iconName, bgColor, onPress, index = 0 }: { title: string, iconName: any, bgColor: string, onPress?: () => void, index?: number }) => (
  <Animated.View entering={FadeInUp.delay(300 + (index * 100)).springify()} style={{ width: '47%', marginBottom: 16 }}>
    <TouchableOpacity 
      onPress={onPress} 
      className={`items-center px-4 py-5 rounded-3xl ${bgColor} shadow-sm border border-black/5`}
      activeOpacity={0.8}
    >
      <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mb-3">
        <Feather name={iconName} size={22} color="white" />
      </View>
      <Text className="text-white font-bold text-center text-[13px] tracking-wide">{title}</Text>
    </TouchableOpacity>
  </Animated.View>
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
      <Animated.View entering={FadeIn.duration(500)} className="bg-[#0F4C3A] flex-row items-center justify-between px-5 py-4">
        <View className="flex-row items-center">
          <View className="w-11 h-11 rounded-full bg-[#F59E0B] items-center justify-center shadow-sm border-2 border-[#D97706]/50">
            <Text className="text-white font-extrabold text-lg">{user.name?.charAt(0) || 'A'}</Text>
          </View>
          <View className="ml-3">
            <Text className="text-white font-extrabold text-xl leading-tight">STYRKA</Text>
            <Text className="text-[#F59E0B] text-[10px] font-bold tracking-[0.2em] mt-0.5">ADMIN PANEL</Text>
          </View>
        </View>

        <TouchableOpacity onPress={logout} className="w-11 h-11 rounded-2xl bg-[#1A634E] items-center justify-center border border-[#144F3D]">
          <Feather name="log-out" size={18} color="#E5E7EB" />
        </TouchableOpacity>
      </Animated.View>

      {/* Main Content Scroll */}
      <ScrollView 
        style={{ flex: 1, backgroundColor: '#F4F7FB' }}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Overview Section */}
        <View className="px-5 pt-6">
          <Animated.Text entering={FadeInDown.delay(100).springify()} className="text-2xl font-black text-[#1F2937] mb-5 tracking-tight">
            Overview
          </Animated.Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color="#0F4C3A" className="my-10" />
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {/* Total Employees */}
              <Animated.View entering={FadeInDown.delay(200).springify()} className="bg-white rounded-[28px] p-5 mb-4 shadow-sm shadow-gray-200 border border-gray-100" style={{ width: '47%' }}>
                <View className="flex-row items-start justify-between">
                  <View className="w-11 h-11 rounded-2xl bg-blue-50 items-center justify-center border border-blue-100">
                    <Feather name="users" size={18} color="#3B82F6" />
                  </View>
                  <View className="items-end flex-1 pl-2">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase text-right tracking-wider">Total</Text>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase text-right tracking-wider">Staff</Text>
                    <Text className="text-3xl font-black text-[#1F2937] mt-1">{stats.employees}</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Pending Tasks */}
              <Animated.View entering={FadeInDown.delay(300).springify()} className="bg-white rounded-[28px] p-5 mb-4 shadow-sm shadow-gray-200 border border-gray-100" style={{ width: '47%' }}>
                <View className="flex-row items-start justify-between">
                  <View className="w-11 h-11 rounded-2xl bg-amber-50 items-center justify-center border border-amber-100">
                    <Feather name="clock" size={18} color="#D97706" />
                  </View>
                  <View className="items-end flex-1 pl-2">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase text-right tracking-wider">Pending</Text>
                    <Text className="text-[10px] font-bold text-gray-400 uppercase text-right tracking-wider">Tasks</Text>
                    <Text className="text-3xl font-black text-[#1F2937] mt-1">{stats.pendingTasks}</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Completed Tasks */}
              <Animated.View entering={FadeInDown.delay(400).springify()} className="bg-white rounded-[28px] p-5 mb-4 shadow-sm shadow-gray-200 border border-gray-100 w-full">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 rounded-2xl bg-emerald-50 items-center justify-center border border-emerald-100">
                      <Feather name="check-circle" size={20} color="#059669" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">Completed</Text>
                      <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tasks</Text>
                    </View>
                  </View>
                  <Text className="text-4xl font-black text-[#1F2937]">{stats.completedTasks}</Text>
                </View>
              </Animated.View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View className="px-5 mt-2">
          <Animated.View entering={FadeInDown.delay(500).springify()} className="bg-white rounded-[32px] shadow-sm shadow-gray-200 border border-gray-100 overflow-hidden pt-1 pb-4">
            <View className="px-6 py-5 border-b border-gray-50 flex-row justify-between items-center">
              <Text className="text-xl font-black text-[#1F2937] tracking-tight">Quick Actions</Text>
              <Feather name="zap" size={20} color="#F59E0B" />
            </View>
            <View className="px-5 pt-6 flex-row flex-wrap justify-between">
              <QuickActionButton index={0} title="Add Staff" iconName="user-plus" bgColor="bg-emerald-600" onPress={() => navigation.navigate('AddEmployee')} />
              <QuickActionButton index={1} title="Assign Task" iconName="check-square" bgColor="bg-amber-500" onPress={() => navigation.navigate('AssignTask')} />
              <QuickActionButton index={2} title="Farmers" iconName="users" bgColor="bg-[#0F4C3A]" onPress={() => navigation.navigate('Farmers')} />
              <QuickActionButton index={3} title="Dealers" iconName="home" bgColor="bg-[#0F4C3A]" onPress={() => navigation.navigate('Dealers')} />
              <QuickActionButton index={4} title="Destinations" iconName="map-pin" bgColor="bg-purple-600" onPress={() => navigation.navigate('AdminDestination')} />
              <QuickActionButton index={5} title="Tracking" iconName="map" bgColor="bg-blue-600" onPress={() => navigation.navigate('AdminTracking')} />
            </View>
          </Animated.View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminDashboard;
