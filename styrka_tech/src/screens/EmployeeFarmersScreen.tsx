import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const FarmerCard = ({ farmer }: any) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-200 overflow-hidden mb-4 mx-4">
      
      {/* Top Main Section */}
      <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={() => setExpanded(!expanded)}
        className="p-4 flex-row items-center"
      >
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

        {/* Actions & Chevron */}
        <View className="flex-row items-center">
          <TouchableOpacity className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mr-2 border border-blue-100">
            <Feather name="edit-2" size={14} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity className="w-8 h-8 rounded-full bg-red-50 items-center justify-center mr-3 border border-red-100">
            <Feather name="trash-2" size={14} color="#EF4444" />
          </TouchableOpacity>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>

      {/* Expanded Details Section */}
      {expanded && (
        <View className="px-5 pt-3 pb-5 border-t border-gray-100 bg-gray-50/50">
          
          <View className="mb-4">
            <View className="flex-row items-center mb-1">
              <Feather name="phone" size={12} color="#6B7280" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1.5">Phone</Text>
            </View>
            <Text className="text-[#1F2937] text-[15px] font-medium">{farmer.phone}</Text>
          </View>

          <View className="mb-4">
            <View className="flex-row items-center mb-1">
              <Feather name="map-pin" size={12} color="#6B7280" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1.5">Village</Text>
            </View>
            <Text className="text-[#1F2937] text-[15px] font-medium">{farmer.village}</Text>
          </View>

          <View className="mb-4">
            <View className="flex-row items-center mb-1">
              <Feather name="home" size={12} color="#6B7280" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1.5">Address</Text>
            </View>
            <Text className="text-[#1F2937] text-[15px] font-medium">{farmer.address || 'N/A'}</Text>
          </View>

          <View className="mb-5">
            <View className="flex-row items-center mb-1">
              <Feather name="check-circle" size={12} color="#6B7280" />
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-1.5">Notes</Text>
            </View>
            <Text className="text-[#1F2937] text-[15px] font-medium">{farmer.notes || 'N/A'}</Text>
          </View>

          <Text className="text-gray-500 text-xs font-medium">Added: {new Date(farmer.created_at).toLocaleDateString()}</Text>
        </View>
      )}

    </View>
  );
};

const AddFarmerModal = ({ visible, onClose, onRefresh }: { visible: boolean, onClose: () => void, onRefresh: () => void }) => {
  const { user } = useAppState();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name) {
      alert("Farmer Name is required");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('farmers').insert([
        {
          added_by: user.id,
          name,
          phone,
          village,
          address,
          notes
        }
      ]);
      
      if (error) throw error;
      
      // reset form
      setName('');
      setPhone('');
      setVillage('');
      setAddress('');
      setNotes('');
      onRefresh();
      onClose();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={onClose} />
          
          <View className="bg-white rounded-t-3xl shadow-xl overflow-hidden" style={{ maxHeight: '90%' }}>
            
            {/* Modal Header */}
            <View className="bg-[#145C44] px-6 py-5 flex-row justify-between items-center relative overflow-hidden">
              <View className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#1A7356] opacity-30" />
              <View>
                <Text className="text-white text-xl font-bold mb-1">Add New Farmer</Text>
                <Text className="text-emerald-100 text-xs">Fill in the farmer's details below</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="w-8 h-8 bg-white/20 rounded-xl items-center justify-center">
                <Feather name="x" size={18} color="white" />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <ScrollView className="px-6 pt-6 pb-6" showsVerticalScrollIndicator={false}>
              
              {/* Crop Media Gallery */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <Feather name="camera" size={14} color="#4B5563" />
                  <Text className="text-[#374151] font-bold text-sm ml-2">Crop Media Gallery <Text className="font-normal text-gray-500">(Photos and Videos)</Text></Text>
                </View>
                <TouchableOpacity className="border border-[#145C44] rounded-xl py-3 px-4 flex-row items-center justify-center bg-emerald-50 self-start mb-3">
                  <Feather name="camera" size={16} color="#145C44" />
                  <Text className="text-[#145C44] font-bold ml-2">Take Photo/Video</Text>
                </TouchableOpacity>
                <TouchableOpacity className="border border-gray-200 rounded-xl py-3 px-4 flex-row items-center justify-center bg-white self-start">
                  <Feather name="image" size={16} color="#4B5563" />
                  <Text className="text-[#4B5563] font-bold ml-2">Choose from Gallery</Text>
                </TouchableOpacity>
              </View>

              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <Feather name="user" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Farmer Name *</Text>
                </View>
                <TextInput 
                  className="border-2 border-[#145C44] rounded-xl px-4 py-3 bg-white text-[#1F2937]"
                  placeholder="e.g. Ramesh Patil"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <Feather name="phone" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Phone Number</Text>
                </View>
                <TextInput 
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]"
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <Feather name="map-pin" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Village / Town</Text>
                </View>
                <TextInput 
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]"
                  placeholder="e.g. Nashik, Maharashtra"
                  placeholderTextColor="#9CA3AF"
                  value={village}
                  onChangeText={setVillage}
                />
              </View>

              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <Feather name="map-pin" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Full Address</Text>
                </View>
                <TextInput 
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937] h-20"
                  placeholder="Start typing to search address..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  textAlignVertical="top"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View className="mb-6">
                <View className="flex-row items-center mb-2">
                  <Feather name="check-circle" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Notes</Text>
                </View>
                <TextInput 
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937] h-20"
                  placeholder="Crop type, acreage, special requirements..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  textAlignVertical="top"
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

            </ScrollView>
            
            {/* Modal Footer */}
            <View className="px-6 py-4 bg-white border-t border-gray-100 flex-row justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <TouchableOpacity 
                onPress={onClose}
                className="border border-gray-200 rounded-xl px-8 py-3.5 bg-white flex-1 mr-3 items-center justify-center"
              >
                <Text className="text-[#374151] font-bold text-[15px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSubmit}
                disabled={isSubmitting}
                className={`bg-[#145C44] rounded-xl px-6 py-3.5 flex-[1.5] flex-row items-center justify-center shadow-sm shadow-[#145C44] ${isSubmitting ? 'opacity-70' : ''}`}
              >
                {isSubmitting && <ActivityIndicator color="white" size="small" className="mr-2" />}
                <Text className="text-white font-bold text-[15px]">{isSubmitting ? 'Adding...' : '+ Add Farmer'}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};


const EmployeeFarmersScreen = () => {
  const { logout, user } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFarmers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('farmers')
        .select('*')
        .eq('added_by', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setFarmers(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user.id) {
      fetchFarmers();
    }
  }, [user.id]);

  const filteredFarmers = farmers.filter(f => 
    f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.phone?.includes(searchQuery) ||
    f.village?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
      {/* Global Header */}
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-[#F59E0B] items-center justify-center shadow-sm border border-[#D97706]">
            <Text className="text-white font-bold text-lg">{user.name?.charAt(0) || 'E'}</Text>
          </View>
          <View className="ml-3">
            <Text className="text-white font-bold text-lg leading-tight">STYRKA</Text>
            <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest">EMPLOYEE PORTAL</Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <TouchableOpacity onPress={logout} className="w-10 h-10 rounded-xl bg-[#1A634E] items-center justify-center border border-[#144F3D]">
            <Feather name="log-out" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="pt-6 pb-2">
            
            <Text className="text-[22px] font-bold text-[#111827] mb-5 mx-5">My Farmers</Text>

            {/* Search and Add Button */}
            <View className="flex-row items-center mb-6 mx-5">
              <View className="flex-1 flex-row items-center bg-white rounded-xl border border-gray-200 px-3 py-3 shadow-sm shadow-gray-100 mr-3">
                <Feather name="search" size={18} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-2 text-sm text-[#1F2937]"
                  placeholder="Search by name, phone, vi"
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity 
                onPress={() => setModalVisible(true)}
                className="bg-[#145C44] rounded-xl px-4 py-3 flex-row items-center shadow-sm shadow-[#145C44]"
              >
                <Feather name="plus" size={16} color="white" />
                <Text className="text-white font-bold text-sm ml-1.5">Add Farmer</Text>
              </TouchableOpacity>
            </View>

            {/* Stat Cards */}
            <View className="flex-row mb-6 mx-5">
              <View className="flex-1 bg-[#E0F2E9] rounded-2xl p-4 flex-row items-center mr-2 shadow-sm border border-[#CDE9D9]">
                <Text className="text-[#145C44] text-2xl font-black mr-2">{farmers.length}</Text>
                <Text className="text-[#145C44] font-medium text-xs">Total Farmers</Text>
              </View>
              <View className="flex-1 bg-[#F5F3FF] rounded-2xl p-4 flex-row items-center ml-2 shadow-sm border border-[#EDE9FE]">
                <Text className="text-[#7C3AED] text-2xl font-black mr-2">{filteredFarmers.length}</Text>
                <Text className="text-[#7C3AED] font-medium text-xs">Search Results</Text>
              </View>
            </View>

            {/* List */}
            {isLoading ? (
              <View className="mt-10 items-center">
                <ActivityIndicator size="large" color="#145C44" />
                <Text className="text-gray-500 mt-2">Loading farmers...</Text>
              </View>
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

      <AddFarmerModal 
        visible={isModalVisible} 
        onClose={() => setModalVisible(false)} 
        onRefresh={fetchFarmers}
      />
    </SafeAreaView>
  );
};

export default EmployeeFarmersScreen;
