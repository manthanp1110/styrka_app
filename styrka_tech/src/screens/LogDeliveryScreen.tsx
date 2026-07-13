import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const LogDeliveryScreen = () => {
  const { logout, user } = useAppState();
  const navigation = useNavigation();
  
  const [dealers, setDealers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [selectedDealer, setSelectedDealer] = useState<any>(null);
  const [productName, setProductName] = useState('');
  const [boxes, setBoxes] = useState('');
  const [orderType, setOrderType] = useState('Purchase');
  const [gstType, setGstType] = useState('GST');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchDealers = async () => {
      try {
        const { data, error } = await supabase
          .from('dealers')
          .select('*')
          .order('name', { ascending: true });
        
        if (!error && data) {
          setDealers(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDealers();
  }, []);

  const handleSubmit = async () => {
    if (!selectedDealer || !productName || !boxes) {
      alert("Please select a dealer and fill out the product details.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('dealer_deliveries').insert([
        {
          dealer_id: selectedDealer.id,
          dealer_name: selectedDealer.name,
          reported_by: user.id,
          product_id: 'PRD-' + Math.floor(Math.random() * 1000), // mock
          product_name: productName,
          boxes: parseInt(boxes),
          order_type: orderType,
          gst_type: gstType,
          delivered_at: new Date().toISOString()
        }
      ]);

      if (error) throw error;
      
      alert("Delivery logged successfully!");
      setProductName('');
      setBoxes('');
      setSelectedDealer(null);
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
            <Text className="text-white font-bold text-lg">{user.name?.charAt(0) || 'E'}</Text>
          </View>
          <View className="ml-3">
            <Text className="text-white font-bold text-lg leading-tight">STYRKA</Text>
            <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest">EMPLOYEE PORTAL</Text>
          </View>
        </View>

        <TouchableOpacity onPress={logout} className="w-10 h-10 rounded-xl bg-[#1A634E] items-center justify-center border border-[#144F3D]">
          <Feather name="log-out" size={18} color="#D1D5DB" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={{ flex: 1, backgroundColor: '#F4F7FB' }}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-6 pb-2">
          <Text className="text-2xl font-bold text-[#1F2937]">Log Delivery Order</Text>
        </View>

        {/* Form Card */}
        <View className="mx-5 mt-3 bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-100 overflow-hidden mb-6">
          <View className="bg-[#107049] p-6">
            <Text className="text-[#86EFAC] text-[10px] font-bold tracking-widest uppercase mb-1">Sales Tracking</Text>
            <Text className="text-white text-xl font-bold mb-1">Register Dealer Order</Text>
            <Text className="text-emerald-100 text-sm">Enter the product details delivered.</Text>
          </View>

          <View className="p-6">
            {/* Dealer Selection */}
            <View className="mb-4">
              <Text className="text-[#374151] font-bold mb-2">Select Dealer</Text>
              {isLoading ? (
                <ActivityIndicator size="small" color="#107049" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {dealers.map(dealer => (
                    <TouchableOpacity 
                      key={dealer.id}
                      onPress={() => setSelectedDealer(dealer)}
                      className={`px-4 py-3 rounded-xl mr-2 border ${
                        selectedDealer?.id === dealer.id ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text className={`font-bold ${selectedDealer?.id === dealer.id ? 'text-emerald-700' : 'text-gray-600'}`}>{dealer.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Inputs */}
            <View className="mb-4">
              <Text className="text-[#374151] font-bold mb-2">Product Name</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]"
                placeholder="e.g. Styrka Super Fertilizer"
                placeholderTextColor="#9CA3AF"
                value={productName}
                onChangeText={setProductName}
              />
            </View>

            <View className="mb-4">
              <Text className="text-[#374151] font-bold mb-2">Total Boxes</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={boxes}
                onChangeText={setBoxes}
              />
            </View>

            <View className="flex-row mb-6">
              <View className="flex-1 mr-2">
                <Text className="text-[#374151] font-bold mb-2">Order Type</Text>
                <View className="flex-row">
                  <TouchableOpacity onPress={() => setOrderType('Purchase')} className={`flex-1 py-2 rounded-l-lg border ${orderType === 'Purchase' ? 'bg-[#107049] border-[#107049]' : 'bg-gray-50 border-gray-200'}`}>
                    <Text className={`text-center font-bold ${orderType === 'Purchase' ? 'text-white' : 'text-gray-500'}`}>Purchase</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setOrderType('Return')} className={`flex-1 py-2 rounded-r-lg border ${orderType === 'Return' ? 'bg-[#107049] border-[#107049]' : 'bg-gray-50 border-gray-200'}`}>
                    <Text className={`text-center font-bold ${orderType === 'Return' ? 'text-white' : 'text-gray-500'}`}>Return</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-1 ml-2">
                <Text className="text-[#374151] font-bold mb-2">Billing</Text>
                <View className="flex-row">
                  <TouchableOpacity onPress={() => setGstType('GST')} className={`flex-1 py-2 rounded-l-lg border ${gstType === 'GST' ? 'bg-amber-500 border-amber-600' : 'bg-gray-50 border-gray-200'}`}>
                    <Text className={`text-center font-bold ${gstType === 'GST' ? 'text-white' : 'text-gray-500'}`}>GST</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setGstType('Non-GST')} className={`flex-1 py-2 rounded-r-lg border ${gstType === 'Non-GST' ? 'bg-amber-500 border-amber-600' : 'bg-gray-50 border-gray-200'}`}>
                    <Text className={`text-center font-bold ${gstType === 'Non-GST' ? 'text-white' : 'text-gray-500'}`}>Non-GST</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={isSubmitting}
              className={`bg-[#107049] rounded-xl py-4 flex-row items-center justify-center ${isSubmitting ? 'opacity-70' : ''}`}
            >
              {isSubmitting && <ActivityIndicator size="small" color="white" className="mr-2" />}
              <Text className="text-white font-bold text-base">{isSubmitting ? 'Submitting...' : 'Log Delivery Record'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LogDeliveryScreen;
