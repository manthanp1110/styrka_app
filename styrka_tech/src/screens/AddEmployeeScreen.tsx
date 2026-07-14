import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const AddEmployeeScreen = () => {
  const { logout, user } = useAppState();
  const navigation = useNavigation<NavigationProp<any>>();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddEmployee = async () => {
    if (!fullName || !email || !password) {
      alert("Please fill all fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Initialize an admin client to bypass RLS for this prototype
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
      
      if (!serviceRoleKey) throw new Error("Service Role Key is missing from .env");
      
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // 1. Create the user in Auth so they can actually log in
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { name: fullName, role: 'employee' }
      });

      if (authError) throw authError;

      // 2. Insert into the public.users table (bypassing RLS with admin client)
      const { error: dbError } = await adminSupabase.from('users').insert([
        {
          id: authData.user.id,
          name: fullName,
          email: email,
          role: 'employee',
        }
      ]);

      if (dbError) {
        // If it fails because a trigger already inserted it, that's fine. Ignore unique constraint errors.
        if (dbError.code !== '23505') throw dbError; 
      }
      
      alert(`Successfully added ${fullName} to the directory! Note: Real Auth requires Supabase Edge Functions.`);
      setFullName('');
      setEmail('');
      setPassword('');
      navigation.goBack();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Custom Header */}
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
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
        <View className="px-5 pt-6 pb-2">
          <Text className="text-2xl font-bold text-[#1F2937]">Add Employee</Text>
        </View>

        {/* Form Card */}
        <View className="mx-5 mt-3 bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-100 overflow-hidden mb-6">
          <View className="bg-[#107049] p-6">
            <Text className="text-[#86EFAC] text-[10px] font-bold tracking-widest uppercase mb-1">HR Management</Text>
            <Text className="text-white text-2xl font-bold mb-1">Enroll New Employee</Text>
            <Text className="text-emerald-100 text-sm">Add a new member to your team</Text>
          </View>

          <View className="p-6">
            <View className="mb-4">
              <Text className="text-[#374151] font-bold mb-2">Full Name</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]"
                placeholder="Jane Doe"
                placeholderTextColor="#9CA3AF"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View className="mb-4">
              <Text className="text-[#374151] font-bold mb-2">Email Address</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]"
                placeholder="employee@company.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View className="mb-1">
              <Text className="text-[#374151] font-bold mb-2">Temporary Password</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]"
                placeholder="Minimum 6 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            <Text className="text-gray-500 text-xs mt-2 mb-6">The employee will use this password to log in for the first time.</Text>

            <TouchableOpacity 
              onPress={handleAddEmployee}
              disabled={isSubmitting}
              className={`bg-[#107049] rounded-xl py-4 flex-row items-center justify-center ${isSubmitting ? 'opacity-70' : ''}`}
            >
              {isSubmitting && <ActivityIndicator size="small" color="white" className="mr-2" />}
              <Text className="text-white font-bold text-base">{isSubmitting ? 'Adding...' : 'Create Employee Account'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Guidelines Card */}
        <View className="mx-5 bg-[#ECFDF5] rounded-3xl border border-[#D1FAE5] p-6 mb-6">
          <View className="flex-row items-center mb-5">
            <Feather name="clipboard" size={18} color="#059669" />
            <Text className="text-[#059669] font-bold text-sm tracking-wider ml-2 uppercase">Guidelines</Text>
          </View>

          <View className="flex-row mb-4 pr-4">
            <Text className="text-[#059669] font-bold text-sm mr-3">1</Text>
            <Text className="text-[#4B5563] text-sm leading-5 flex-1">Use the employee's work email address for account creation.</Text>
          </View>

          <View className="flex-row mb-4 pr-4">
            <Text className="text-[#059669] font-bold text-sm mr-3">2</Text>
            <Text className="text-[#4B5563] text-sm leading-5 flex-1">Set a strong temporary password — ask them to change it after first login.</Text>
          </View>

          <View className="flex-row pr-4">
            <Text className="text-[#059669] font-bold text-sm mr-3">3</Text>
            <Text className="text-[#4B5563] text-sm leading-5 flex-1">The employee will appear in the directory and can be assigned tasks immediately.</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default AddEmployeeScreen;
