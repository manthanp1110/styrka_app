import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator } from 'react-native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const LoginScreen = () => {
  const { checkSession } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        // Auth successful, refresh global state
        await checkSession();
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F3F4F6]">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-5"
      >
        {/* Header Section */}
        <View className="items-center mb-6 mt-10">
          {/* Logo Placeholder */}
          <View className="w-24 h-24 rounded-full bg-gradient-to-b from-[#D97706] to-[#78350F] items-center justify-center mb-4 shadow-lg border-2 border-[#451A03] overflow-hidden">
             <View className="absolute inset-0 bg-[#9A3412] opacity-50" />
             <View className="w-2 h-6 bg-[#FEF08A] rounded-t-full z-10" />
             <View className="w-8 h-1 bg-[#FCD34D] mt-1 z-10" />
             <View className="w-6 h-4 bg-[#78350F] z-10 mt-1" />
          </View>
          
          <Text className="text-2xl font-extrabold text-[#111827] mb-2 tracking-tight">STYRKA Tech Serve</Text>
          <Text className="text-sm text-[#6B7280]">Welcome to the Employee Portal</Text>
        </View>

        {/* Login Card */}
        <View className="bg-white rounded-3xl p-6 shadow-md shadow-gray-200 w-full mb-10">
          <Text className="text-[22px] font-bold text-[#2563EB] text-center mb-6">Sign In</Text>

          {errorMsg ? (
            <View className="bg-red-50 border border-red-200 p-3 rounded-lg mb-4">
              <Text className="text-red-600 text-sm text-center">{errorMsg}</Text>
            </View>
          ) : null}

          <View className="mb-5">
            <Text className="text-sm font-bold text-[#374151] mb-2">Email Address</Text>
            <TextInput 
              className="w-full bg-[#171717] text-white px-4 py-4 rounded-xl text-base"
              placeholder="name@company.com"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="mb-8">
            <Text className="text-sm font-bold text-[#374151] mb-2">Password</Text>
            <TextInput 
              className="w-full bg-[#171717] text-white px-4 py-4 rounded-xl text-base tracking-widest"
              placeholder="••••••••"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            className={`w-full py-4 rounded-xl items-center mb-6 flex-row justify-center ${isLoading ? 'bg-[#93C5FD]' : 'bg-[#2563EB] active:bg-[#1D4ED8]'}`}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading && <ActivityIndicator color="white" className="mr-2" />}
            <Text className="text-white text-lg font-bold">{isLoading ? 'Signing In...' : 'Log In'}</Text>
          </TouchableOpacity>

          <Text className="text-center text-[13px] text-[#9CA3AF]">
            Need access? Contact your administrator.
          </Text>
        </View>

      </KeyboardAvoidingView>
      
      {/* Footer */}
      <View className="pb-8 items-center justify-end">
        <Text className="text-sm text-[#9CA3AF] font-medium">
          © 2026 Styrka Tech Serve · We Serve Better
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
