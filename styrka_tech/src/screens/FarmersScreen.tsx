import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../config/supabase';

const FarmerCard = ({ farmer }: any) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-200 overflow-hidden mb-4 mx-4">
      <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded(!expanded)} className="p-4 flex-row items-center">
        <View className="w-14 h-14 bg-[#145C44] rounded-2xl items-center justify-center mr-4">
          <Text className="text-white text-2xl font-bold">{farmer.name ? farmer.name.charAt(0) : '?'}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-[#145C44] font-extrabold text-base mr-1">{farmer.name}</Text>
            <Feather name="external-link" size={12} color="#4B5563" />
          </View>
          <View className="flex-row items-center mb-0.5">
            <Feather name="phone" size={12} color="#6B7280" />
            <Text className="text-gray-500 text-xs ml-1.5">{farmer.phone}</Text>
          </View>
          <View className="flex-row items-center">
            <Feather name="map-pin" size={12} color="#6B7280" />
            <Text className="text-gray-500 text-xs ml-1.5">{farmer.village}</Text>
          </View>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
      </TouchableOpacity>
      {expanded && (
        <View className="px-5 pt-3 pb-5 border-t border-gray-100 bg-gray-50/50">
          <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Address</Text>
          <Text className="text-[#1F2937] text-[15px] font-medium mb-4">{farmer.address || 'N/A'}</Text>

          <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Notes</Text>
          <Text className="text-[#1F2937] text-[15px] font-medium mb-4">{farmer.notes || 'N/A'}</Text>
          
          <Text className="text-gray-500 text-xs font-medium">Added: {new Date(farmer.created_at).toLocaleDateString()}</Text>
        </View>
      )}
    </View>
  );
};

const FarmersScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [farmers, setFarmers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const { data, error } = await supabase
          .from('farmers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setFarmers(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFarmers();
  }, []);

  const filteredFarmers = farmers.filter(f => 
    f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.phone?.includes(searchQuery) ||
    f.village?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Text className="text-white text-2xl font-bold">All Farmers</Text>
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
                placeholder="Search by name, phone, village"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" color="#145C44" className="mt-10" />
            ) : filteredFarmers.length > 0 ? (
              filteredFarmers.map(f => (
                <FarmerCard key={f.id} farmer={f} />
              ))
            ) : (
              <View className="mt-10 items-center">
                <Feather name="users" size={40} color="#D1D5DB" />
                <Text className="text-gray-500 mt-3 font-medium">No farmers found.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default FarmersScreen;
