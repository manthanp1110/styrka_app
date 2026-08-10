import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator } from 'react-native';
import { useAppState } from '../store/useAppState';
import { TrackingDataService } from '../services/TrackingDataService';

const LoginScreen = () => {
  const { setSession } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email) {
      setErrorMsg('Please enter an email address or username.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const user = TrackingDataService.getUser(email);
      if (user) {
        await setSession(user.id, user.role, user.name, user.email);
      } else {
        setErrorMsg('User not found. Try admin@styrka.com or rahul@styrka.com');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsRole = async (role: 'admin' | 'employee') => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (role === 'admin') {
        const user = TrackingDataService.getUser('admin@styrka.com')!;
        await setSession(user.id, user.role, user.name, user.email);
      } else {
        const user = TrackingDataService.getUser('rahul@styrka.com')!;
        await setSession(user.id, user.role, user.name, user.email);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0F4C3A]">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-6"
      >
        {/* Header Section */}
        <View className="items-center mb-8 mt-10">
          <View className="w-20 h-20 rounded-2xl bg-amber-500 items-center justify-center mb-4 shadow-lg border-2 border-amber-600">
             <Text className="text-white text-3xl font-extrabold">S</Text>
          </View>
          
          <Text className="text-2xl font-extrabold text-white mb-1 tracking-tight">STYRKA Live Tracker</Text>
          <Text className="text-sm text-emerald-200">Dispatch & Real-time Location Tracking</Text>
        </View>

        {/* Login Card */}
        <View className="bg-white rounded-3xl p-6 shadow-xl w-full mb-6">
          <Text className="text-xl font-bold text-[#0F4C3A] text-center mb-4">Sign In</Text>

          {errorMsg ? (
            <View className="bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
              <Text className="text-red-600 text-xs text-center font-medium">{errorMsg}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Email or Username</Text>
            <TextInput 
              className="w-full bg-gray-100 text-gray-900 px-4 py-3.5 rounded-xl text-base"
              placeholder="admin@styrka.com or rahul@styrka.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="mb-6">
            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Password</Text>
            <TextInput 
              className="w-full bg-gray-100 text-gray-900 px-4 py-3.5 rounded-xl text-base"
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            className={`w-full py-4 rounded-xl items-center mb-4 flex-row justify-center ${isLoading ? 'bg-emerald-400' : 'bg-[#0F4C3A] active:bg-emerald-900'}`}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading && <ActivityIndicator color="white" className="mr-2" />}
            <Text className="text-white text-base font-bold">{isLoading ? 'Signing In...' : 'Log In'}</Text>
          </TouchableOpacity>

          <View className="flex-row items-center my-3">
            <View className="flex-1 h-[1px] bg-gray-200" />
            <Text className="mx-3 text-xs text-gray-400 font-semibold">QUICK DEMO ACCESS</Text>
            <View className="flex-1 h-[1px] bg-gray-200" />
          </View>

          <View className="flex-row space-x-3 gap-2">
            <TouchableOpacity 
              className="flex-1 bg-amber-500 py-3 rounded-xl items-center"
              onPress={() => loginAsRole('admin')}
            >
              <Text className="text-white font-bold text-sm">Admin Portal</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-1 bg-emerald-700 py-3 rounded-xl items-center"
              onPress={() => loginAsRole('employee')}
            >
              <Text className="text-white font-bold text-sm">Employee Portal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      
      {/* Footer */}
      <View className="pb-6 items-center justify-end">
        <Text className="text-xs text-emerald-200 font-medium">
          © 2026 Styrka Live Tracking System
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;

