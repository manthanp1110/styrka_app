import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const EmployeeCard = ({ employee, avatarColor }: any) => {
  const navigation = useNavigation<NavigationProp<any>>();
  const initial = employee.name ? employee.name.charAt(0) : 'U';

  return (
    <View className="bg-white rounded-3xl p-5 mb-5 shadow-sm shadow-gray-200 border border-gray-100">
      <View className="flex-row justify-between items-start mb-4">
        {/* Avatar */}
        <View className={`w-16 h-16 rounded-full items-center justify-center shadow-md shadow-gray-300 ${avatarColor}`}>
          <Text className="text-white text-2xl font-bold">{initial}</Text>
        </View>

        {/* Active Badge */}
        <View className="bg-emerald-100 px-3 py-1.5 rounded-full flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          <Text className="text-emerald-700 font-bold text-xs">Active</Text>
        </View>
      </View>

      {/* Employee Details */}
      <View className="mb-5">
        <Text className="text-[#1F2937] text-lg font-bold mb-1">{employee.name || 'Unknown'}</Text>
        <Text className="text-gray-500 text-sm">{employee.email}</Text>
      </View>

      {/* Footer Badges & Actions */}
      <View className="flex-row justify-between items-center pt-2">
        <View className="bg-gray-100 px-4 py-2 rounded-2xl">
          <Text className="text-gray-700 font-bold text-xs tracking-wide">Employee</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('EmployeeProfile', { employee })} className="flex-row items-center">
          <Text className="text-gray-600 font-bold text-sm mr-1">View profile</Text>
          <Feather name="arrow-right" size={16} color="#4B5563" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const EmployeeDirectoryScreen = () => {
  const { logout, user } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase.from('users').select('*').eq('role', 'employee').order('created_at', { ascending: false });
        if (error) throw error;
        setEmployees(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter(emp => {
    return emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getAvatarColor = (idx: number) => {
    const colors = ['bg-orange-500', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500'];
    return colors[idx % colors.length];
  };

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
        <View className="px-5 pt-6 pb-4">
          <Text className="text-2xl font-bold text-[#1F2937]">Employee Directory</Text>
        </View>

        {/* Hero Card */}
        <View className="mx-5 bg-[#145C44] rounded-[28px] p-6 mb-6 overflow-hidden relative shadow-md shadow-gray-300">
          <View className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#1A7356] opacity-40" />
          <View className="absolute -bottom-10 right-20 w-32 h-32 rounded-full bg-[#1A7356] opacity-40" />

          <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest uppercase mb-2">Human Resources</Text>
          <Text className="text-white text-3xl font-extrabold tracking-tight mb-2">Employee Directory</Text>
          <Text className="text-emerald-100 text-sm mb-6">Manage and view your team members</Text>

          {/* Stats */}
          <View className="flex-row items-center mb-6">
            <View>
              <Text className="text-white text-3xl font-black">{employees.length}</Text>
              <Text className="text-emerald-100 text-xs font-semibold">Total</Text>
            </View>
            <View className="w-px h-10 bg-emerald-700 mx-5" />
            <View>
              <Text className="text-[#4ADE80] text-3xl font-black">{employees.length}</Text>
              <Text className="text-emerald-100 text-xs font-semibold">Active</Text>
            </View>
          </View>

          {/* Search Input inside Card */}
          <View className="flex-row items-center bg-[#1A7356] rounded-2xl border border-[#218F6B] px-4 py-3">
            <Feather name="search" size={18} color="#86EFAC" />
            <TextInput
              className="flex-1 ml-3 text-sm text-white"
              placeholder="Search by name or email..."
              placeholderTextColor="#86EFAC"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Employee List */}
        <View className="px-5">
          {isLoading ? (
            <ActivityIndicator size="large" color="#0F4C3A" className="mt-10" />
          ) : filteredEmployees.length > 0 ? (
            filteredEmployees.map((emp, idx) => (
              <EmployeeCard 
                key={emp.id}
                employee={emp}
                avatarColor={getAvatarColor(idx)}
              />
            ))
          ) : (
            <View className="items-center py-10 bg-white rounded-3xl shadow-sm border border-gray-100">
              <Text className="text-gray-500">No employees found.</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default EmployeeDirectoryScreen;
