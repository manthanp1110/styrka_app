import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../config/supabase';

const DealerCard = ({ dealer }: any) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className={`bg-white rounded-2xl shadow-sm shadow-gray-200 overflow-hidden mb-4 mx-5 border ${expanded ? 'border-[#F59E0B]' : 'border-gray-200'}`}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded(!expanded)} className="p-4 flex-row items-center">
        <View className="w-14 h-14 bg-[#F59E0B] rounded-2xl items-center justify-center mr-4">
          <Text className="text-white text-2xl font-bold">{dealer.name ? dealer.name.charAt(0) : '?'}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-[#1F2937] font-extrabold text-base mr-1">{dealer.name}</Text>
            <Feather name="external-link" size={12} color="#F59E0B" />
          </View>
          <View className="flex-row items-center">
            <Feather name="map-pin" size={12} color="#6B7280" />
            <Text className="text-gray-500 text-xs ml-1.5">{dealer.city}</Text>
          </View>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {expanded && (
        <View className="px-5 pt-4 pb-5 border-t border-[#FEF3C7] bg-[#FFFBEE]">
          <View className="mb-4">
            <View className="flex-row items-center mb-1">
              <Feather name="map-pin" size={12} color="#9CA3AF" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1.5">City</Text>
            </View>
            <Text className="text-[#1F2937] text-[15px] font-medium">{dealer.city}</Text>
          </View>

          <View className="mb-4">
            <View className="flex-row items-center mb-1">
              <Feather name="file-text" size={12} color="#9CA3AF" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1.5">GSTIN</Text>
            </View>
            <Text className="text-[#1F2937] text-[15px] font-medium">{dealer.gstin || 'N/A'}</Text>
          </View>

          <View className="mb-4">
            <View className="flex-row items-center mb-1">
              <Feather name="home" size={12} color="#9CA3AF" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1.5">Address</Text>
            </View>
            <Text className="text-[#1F2937] text-[15px] font-medium leading-relaxed">{dealer.address || 'N/A'}</Text>
          </View>

          <View className="mb-6">
            <View className="flex-row items-center mb-1">
              <Feather name="check-circle" size={12} color="#9CA3AF" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1.5">Notes</Text>
            </View>
            <Text className="text-[#1F2937] text-[15px] font-medium">{dealer.notes || 'N/A'}</Text>
          </View>

          <Text className="text-gray-400 text-xs font-medium">Added: {new Date(dealer.created_at).toLocaleDateString()}</Text>
        </View>
      )}
    </View>
  );
};

const DealersScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [dealers, setDealers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDealers = async () => {
      try {
        const { data, error } = await supabase
          .from('dealers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setDealers(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDealers();
  }, []);

  const filteredDealers = dealers.filter(d => 
    d.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.phone?.includes(searchQuery) ||
    d.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
      <View className="bg-[#0F4C3A] px-5 py-6 relative">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-[#1A7356] rounded-xl items-center justify-center mr-4 border border-[#218F6B]">
            <Feather name="arrow-left" size={20} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-[#F59E0B] text-xs font-bold tracking-wider mb-1 uppercase">Directory</Text>
            <Text className="text-white text-2xl font-bold">All Dealers</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="pt-6 pb-2">
            <View className="flex-row items-center mb-6 mx-5 bg-white rounded-xl border border-gray-200 px-3 py-3 shadow-sm">
              <Feather name="search" size={18} color="#9CA3AF" />
              <TextInput
                className="flex-1 ml-2 text-sm text-[#1F2937]"
                placeholder="Search by name, phone, city"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" color="#F59E0B" className="mt-10" />
            ) : filteredDealers.length > 0 ? (
              filteredDealers.map(d => (
                <DealerCard key={d.id} dealer={d} />
              ))
            ) : (
              <View className="mt-10 items-center">
                <Feather name="home" size={40} color="#D1D5DB" />
                <Text className="text-gray-500 mt-3 font-medium">No dealers found.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default DealersScreen;
