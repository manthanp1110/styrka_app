import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const productsList = [
  {
    id: 'dr_future_gold',
    name: 'Dr. Future Gold',
    subtitle: 'Sea-Weed Gel | Plant Nutrition',
    dotColor: 'bg-[#B4853F]',
    variants: [{ size: '500 GM' }]
  },
  {
    id: 'dr_future_act_fast',
    name: 'Dr. Future Act-Fast',
    subtitle: 'Balanced Crop Nutrition',
    dotColor: 'bg-[#4B8933]',
    variants: [
      { size: '50 ML' },
      { size: '100 ML' },
      { size: '250 ML' },
      { size: '500 ML' }
    ]
  },
  {
    id: 'super_grow',
    name: 'Super Grow',
    subtitle: 'Ultimate Growth Enhancer',
    dotColor: 'bg-[#186D51]',
    variants: [
      { size: '100 ML' },
      { size: '250 ML' }
    ]
  },
  {
    id: 'white_gold',
    name: 'White Gold',
    subtitle: 'Mycorrhizal Biofertilizer',
    dotColor: 'bg-[#2A7543]',
    variants: [{ size: '100 GM' }]
  }
];

const LogDeliveryModal = ({ visible, onClose, dealer }: any) => {
  const { user } = useAppState();
  const [gstType, setGstType] = useState('GST');
  const [orderType, setOrderType] = useState('Cash');
  const [quantities, setQuantities] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasEnteredQuantity = Object.values(quantities).some((v: any) => parseInt(v || '0', 10) > 0);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Create an array of delivery records to insert
    const deliveriesToInsert = [];
    
    for (const [key, qty] of Object.entries(quantities)) {
      const boxes = parseInt(qty as string, 10);
      if (boxes > 0) {
        // key format is "productId-size"
        const [productId, size] = key.split('-');
        
        deliveriesToInsert.push({
          dealer_id: dealer.id,
          dealer_name: dealer.name,
          reported_by: user.id,
          product_id: productId,
          product_name: size, // using size as product name variation for now based on schema
          boxes: boxes,
          gst_type: gstType,
          order_type: orderType
        });
      }
    }
    
    try {
      const { error } = await supabase.from('dealer_deliveries').insert(deliveriesToInsert);
      if (error) throw error;
      
      alert('Delivery logged successfully!');
      setQuantities({});
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 bg-black/50 justify-end pt-10">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={onClose} />
          
          <View className="bg-white rounded-t-3xl shadow-xl flex-1 overflow-hidden">
            
            {/* Header */}
            <View className="bg-[#145C44] px-5 py-4 flex-row justify-between items-center relative overflow-hidden">
              <View className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#1A7356] opacity-30" />
              <View className="flex-row items-center">
                <Feather name="truck" size={20} color="white" />
                <View className="ml-3">
                  <Text className="text-white text-lg font-bold">Log Delivery</Text>
                  <Text className="text-emerald-100 text-[11px]">to {dealer?.name} • {dealer?.city}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} className="w-8 h-8 bg-white/20 rounded-xl items-center justify-center">
                <Feather name="x" size={18} color="white" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              
              {/* Toggles */}
              <View className="flex-row px-5 py-5 border-b border-gray-100">
                <View className="flex-1 mr-2">
                  <Text className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-2">GST TYPE</Text>
                  <View className="flex-row bg-[#F3F4F6] rounded-xl p-1">
                    <TouchableOpacity 
                      onPress={() => setGstType('GST')}
                      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${gstType === 'GST' ? 'bg-[#D1FAE5] shadow-sm' : ''}`}
                    >
                      <Feather name="dollar-sign" size={14} color={gstType === 'GST' ? '#047857' : '#9CA3AF'} />
                      <Text className={`font-bold ml-1.5 ${gstType === 'GST' ? 'text-[#047857]' : 'text-[#9CA3AF]'}`}>GST</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setGstType('Non-GST')}
                      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${gstType === 'Non-GST' ? 'bg-white shadow-sm' : ''}`}
                    >
                      <Feather name="file-text" size={14} color={gstType === 'Non-GST' ? '#374151' : '#9CA3AF'} />
                      <Text className={`font-bold ml-1.5 ${gstType === 'Non-GST' ? 'text-[#374151]' : 'text-[#9CA3AF]'}`}>Non-GST</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="flex-1 ml-2">
                  <Text className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-2">ORDER TYPE</Text>
                  <View className="flex-row bg-[#F3F4F6] rounded-xl p-1">
                    <TouchableOpacity 
                      onPress={() => setOrderType('Cash')}
                      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${orderType === 'Cash' ? 'bg-[#FEF3C7] shadow-sm' : ''}`}
                    >
                      <Feather name="credit-card" size={14} color={orderType === 'Cash' ? '#D97706' : '#9CA3AF'} />
                      <Text className={`font-bold ml-1.5 ${orderType === 'Cash' ? 'text-[#D97706]' : 'text-[#9CA3AF]'}`}>Cash</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setOrderType('Credit')}
                      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${orderType === 'Credit' ? 'bg-white shadow-sm' : ''}`}
                    >
                      <Feather name="credit-card" size={14} color={orderType === 'Credit' ? '#374151' : '#9CA3AF'} />
                      <Text className={`font-bold ml-1.5 ${orderType === 'Credit' ? 'text-[#374151]' : 'text-[#9CA3AF]'}`}>Credit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View className="px-5 py-4 border-b border-gray-100">
                <Text className="text-gray-500 text-sm">Enter the number of boxes delivered for each product. Leave blank or 0 to skip.</Text>
              </View>

              {/* Product List */}
              <View className="px-5 py-4">
                {productsList.map((product) => (
                  <View key={product.id} className="border border-gray-200 rounded-2xl mb-4 bg-white shadow-sm shadow-gray-50 overflow-hidden">
                    <View className="p-4 flex-row">
                      <View className={`w-2.5 h-2.5 rounded-full ${product.dotColor} mt-1.5 mr-3`} />
                      <View className="flex-1">
                        <Text className="text-[#1F2937] font-bold text-[15px]">{product.name}</Text>
                        <Text className="text-gray-500 text-xs mb-3">{product.subtitle}</Text>
                        
                        {/* Variants List inside the product card */}
                        {product.variants.map((v, i) => (
                          <View key={i} className={`flex-row items-center justify-end ${i !== product.variants.length - 1 ? 'mb-3' : ''}`}>
                            <Text className="text-gray-600 font-bold text-[11px] mr-3">{v.size}</Text>
                            <View className="border border-gray-200 rounded-lg w-16 h-10 items-center justify-center bg-gray-50 mr-2">
                              <TextInput
                                className="text-center font-bold text-[#1F2937] w-full h-full"
                                placeholder="0"
                                keyboardType="number-pad"
                                value={quantities[`${product.id}-${v.size}`] || ''}
                                onChangeText={(val) => setQuantities({ ...quantities, [`${product.id}-${v.size}`]: val })}
                              />
                            </View>
                            <Text className="text-gray-400 text-xs w-8">boxes</Text>
                          </View>
                        ))}

                      </View>
                    </View>
                  </View>
                ))}
              </View>

            </ScrollView>
            
            {/* Footer */}
            <View className="px-6 py-4 bg-white border-t border-gray-100 flex-row justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <TouchableOpacity onPress={onClose} className="border border-gray-200 rounded-xl px-6 py-3.5 bg-white mr-3 items-center justify-center">
                <Text className="text-[#374151] font-bold text-[15px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                disabled={!hasEnteredQuantity || isSubmitting}
                onPress={handleSubmit}
                className={`rounded-xl px-6 py-3.5 flex-1 flex-row items-center justify-center shadow-sm ${hasEnteredQuantity ? 'bg-[#4B5563]' : 'bg-[#9CA3AF]'} ${isSubmitting ? 'opacity-70' : ''}`}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Feather name="truck" size={16} color="white" />
                    <Text className="text-white font-bold text-[15px] ml-2">Submit Report</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};


const DealerCard = ({ dealer, onLogDelivery }: any) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className={`bg-white rounded-2xl shadow-sm shadow-gray-200 overflow-hidden mb-4 mx-5 border ${expanded ? 'border-[#F59E0B]' : 'border-gray-200'}`}>
      
      {/* Top Main Section */}
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

          <Text className="text-gray-400 text-xs font-medium mb-4">Added: {new Date(dealer.created_at).toLocaleDateString()}</Text>

          <TouchableOpacity 
            onPress={onLogDelivery}
            className="bg-[#145C44] rounded-xl py-3.5 flex-row justify-center items-center self-start px-6 shadow-sm shadow-gray-300"
          >
            <Feather name="truck" size={16} color="white" />
            <Text className="text-white font-bold ml-2 text-sm">Log Delivery</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};


const AddDealerModal = ({ visible, onClose, onRefresh }: { visible: boolean, onClose: () => void, onRefresh: () => void }) => {
  const { user } = useAppState();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name) {
      alert("Dealer Name is required");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('dealers').insert([
        {
          added_by: user.id,
          name,
          phone,
          city,
          address,
          gstin,
          notes
        }
      ]);
      
      if (error) throw error;
      
      setName('');
      setPhone('');
      setCity('');
      setAddress('');
      setGstin('');
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
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={onClose} />
          
          <View className="bg-white rounded-t-3xl shadow-xl overflow-hidden" style={{ maxHeight: '90%' }}>
            
            {/* Modal Header */}
            <View className="bg-[#145C44] px-6 py-5 flex-row justify-between items-center relative overflow-hidden">
              <View className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#1A7356] opacity-30" />
              <View>
                <Text className="text-white text-xl font-bold mb-1">Add New Dealer</Text>
                <Text className="text-emerald-100 text-xs">Fill in the dealer's details below</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="w-8 h-8 bg-white/20 rounded-xl items-center justify-center">
                <Feather name="x" size={18} color="white" />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <ScrollView className="px-6 pt-6 pb-6" showsVerticalScrollIndicator={false}>
              
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <Feather name="camera" size={14} color="#4B5563" />
                  <Text className="text-[#374151] font-bold text-sm ml-2">Shop Media Gallery <Text className="font-normal text-gray-500">(Photos and Videos)</Text></Text>
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
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Dealer Name *</Text>
                </View>
                <TextInput className="border-2 border-[#145C44] rounded-xl px-4 py-3 bg-white text-[#1F2937]" placeholder="e.g. Ramesh Patil" placeholderTextColor="#9CA3AF" value={name} onChangeText={setName} />
              </View>

              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <Feather name="phone" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Phone Number</Text>
                </View>
                <TextInput className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]" placeholder="+91 98765 43210" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              </View>
              
              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <Feather name="file-text" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">GSTIN</Text>
                </View>
                <TextInput className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]" placeholder="27AA..." placeholderTextColor="#9CA3AF" value={gstin} onChangeText={setGstin} />
              </View>

              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <Feather name="map-pin" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Village / Town / City</Text>
                </View>
                <TextInput className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937]" placeholder="e.g. Nashik, Maharashtra" placeholderTextColor="#9CA3AF" value={city} onChangeText={setCity} />
              </View>

              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <Feather name="map-pin" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Full Address</Text>
                </View>
                <TextInput className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937] h-20" placeholder="Start typing to search address..." placeholderTextColor="#9CA3AF" multiline textAlignVertical="top" value={address} onChangeText={setAddress} />
              </View>

              <View className="mb-6">
                <View className="flex-row items-center mb-2">
                  <Feather name="check-circle" size={14} color="#6B7280" />
                  <Text className="text-[#374151] font-bold text-sm ml-1.5">Notes</Text>
                </View>
                <TextInput className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-[#1F2937] h-20" placeholder="Shop type, special requirements..." placeholderTextColor="#9CA3AF" multiline textAlignVertical="top" value={notes} onChangeText={setNotes} />
              </View>

            </ScrollView>
            
            {/* Modal Footer */}
            <View className="px-6 py-4 bg-white border-t border-gray-100 flex-row justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <TouchableOpacity onPress={onClose} className="border border-gray-200 rounded-xl px-8 py-3.5 bg-white flex-1 mr-3 items-center justify-center">
                <Text className="text-[#374151] font-bold text-[15px]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                disabled={isSubmitting}
                onPress={handleSubmit}
                className={`bg-[#145C44] rounded-xl px-6 py-3.5 flex-[1.5] flex-row items-center justify-center shadow-sm shadow-[#145C44] ${isSubmitting ? 'opacity-70' : ''}`}
              >
                {isSubmitting && <ActivityIndicator color="white" size="small" className="mr-2" />}
                <Text className="text-white font-bold text-[15px]">{isSubmitting ? 'Adding...' : '+ Add Dealer'}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};


const EmployeeDealersScreen = () => {
  const { logout, user } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [activeLogDealer, setActiveLogDealer] = useState<any>(null);
  const [dealers, setDealers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDealers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('*')
        .eq('added_by', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDealers(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user.id) {
      fetchDealers();
    }
  }, [user.id]);

  const filteredDealers = dealers.filter(d => 
    d.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.phone?.includes(searchQuery) ||
    d.city?.toLowerCase().includes(searchQuery.toLowerCase())
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
            
            <Text className="text-[22px] font-bold text-[#111827] mb-5 mx-5">Dealer</Text>

            {/* Search and Add Button */}
            <View className="flex-row items-center mb-6 mx-5">
              <View className="flex-1 flex-row items-center bg-white rounded-xl border border-gray-200 px-3 py-3 shadow-sm shadow-gray-100 mr-3">
                <Feather name="search" size={18} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-2 text-sm text-[#1F2937]"
                  placeholder="Search by name, phone, cit"
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity 
                onPress={() => setAddModalVisible(true)}
                className="bg-[#F59E0B] rounded-xl px-4 py-3 flex-row items-center shadow-sm shadow-[#F59E0B]"
              >
                <Feather name="plus" size={16} color="white" />
                <Text className="text-white font-bold text-sm ml-1.5">Add Dealer</Text>
              </TouchableOpacity>
            </View>

            {/* Stat Cards */}
            <View className="flex-row mb-6 mx-5">
              <View className="flex-1 bg-[#FFFBEB] rounded-2xl p-4 flex-row items-center mr-2 shadow-sm border border-[#FEF3C7]">
                <Text className="text-[#D97706] text-2xl font-black mr-2">{dealers.length}</Text>
                <Text className="text-[#D97706] font-medium text-xs">Total Dealers</Text>
              </View>
              <View className="flex-1 bg-[#F5F3FF] rounded-2xl p-4 flex-row items-center ml-2 shadow-sm border border-[#EDE9FE]">
                <Text className="text-[#7C3AED] text-2xl font-black mr-2">{filteredDealers.length}</Text>
                <Text className="text-[#7C3AED] font-medium text-xs">Search Results</Text>
              </View>
            </View>

            {/* List */}
            {isLoading ? (
              <View className="mt-10 items-center">
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text className="text-gray-500 mt-2">Loading dealers...</Text>
              </View>
            ) : filteredDealers.length > 0 ? (
              filteredDealers.map(d => (
                <DealerCard 
                  key={d.id} 
                  dealer={d} 
                  onLogDelivery={() => setActiveLogDealer(d)}
                />
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

      <AddDealerModal 
        visible={isAddModalVisible} 
        onClose={() => setAddModalVisible(false)} 
        onRefresh={fetchDealers} 
      />
      
      {activeLogDealer && (
        <LogDeliveryModal 
          visible={!!activeLogDealer}
          onClose={() => setActiveLogDealer(null)}
          dealer={activeLogDealer}
        />
      )}

    </SafeAreaView>
  );
};

export default EmployeeDealersScreen;
