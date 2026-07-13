import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const EmployeeLeaveScreen = () => {
  const { logout, user } = useAppState();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLeaves = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLeaves(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user.id) {
      fetchLeaves();
    }
  }, [user.id]);

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason) {
      alert("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('leave_requests').insert([
        {
          user_id: user.id,
          start_date: startDate,
          end_date: endDate,
          reason,
          status: 'Pending'
        }
      ]);

      if (error) throw error;

      alert("Leave request submitted successfully.");
      setIsFormVisible(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      fetchLeaves();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Main Content Area */}
        <View className="px-5 pt-6">
          <Text className="text-[#111827] text-[22px] font-bold mb-6">Leave</Text>
          
          <Text className="text-[#1F2937] text-xl font-bold mb-1 tracking-tight">Leave Management</Text>
          <Text className="text-[#6B7280] text-sm mb-6">Request time off and track your leaves.</Text>

          {/* Toggle Button */}
          {!isFormVisible && (
            <TouchableOpacity 
              onPress={() => setIsFormVisible(true)}
              className="bg-[#145C44] rounded-xl flex-row items-center self-start px-4 py-2.5 mb-8 shadow-sm shadow-[#145C44]"
            >
              <Feather name="plus" size={18} color="white" />
              <Text className="text-white font-bold ml-2">Apply for Leave</Text>
            </TouchableOpacity>
          )}

          {/* Expandable Form */}
          {isFormVisible && (
            <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-100 overflow-hidden mb-8">
              <View className="bg-[#145C44] flex-row items-center px-6 py-5">
                <Feather name="calendar" size={20} color="white" />
                <Text className="text-white font-bold text-lg ml-3">New Leave Request</Text>
              </View>

              <View className="px-6 pt-6 pb-6">
                
                <View className="mb-5">
                  <Text className="text-[#374151] font-bold text-[13px] mb-2">Start Date</Text>
                  <TextInput 
                    className="border border-gray-300 rounded-xl px-4 py-3 bg-white text-[#374151]"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>

                <View className="mb-5">
                  <Text className="text-[#374151] font-bold text-[13px] mb-2">End Date</Text>
                  <TextInput 
                    className="border border-gray-300 rounded-xl px-4 py-3 bg-white text-[#374151]"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </View>

                <View className="mb-6">
                  <Text className="text-[#374151] font-bold text-[13px] mb-2">Reason for Leave</Text>
                  <TextInput 
                    className="border border-gray-300 rounded-xl px-4 py-3 bg-white text-[#374151] h-28 text-left text-[15px]"
                    placeholder="Please explain why you need time off..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                    value={reason}
                    onChangeText={setReason}
                  />
                </View>

                <View className="flex-row justify-end items-center">
                  <TouchableOpacity 
                    onPress={() => setIsFormVisible(false)}
                    className="border border-gray-200 rounded-xl px-6 py-3 mr-3 bg-white"
                  >
                    <Text className="text-[#1F2937] font-bold text-[15px]">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    className={`bg-[#F59E0B] rounded-xl px-6 py-3 flex-row items-center shadow-sm shadow-[#F59E0B] ${isSubmitting ? 'opacity-70' : ''}`}
                  >
                    {isSubmitting && <ActivityIndicator color="white" size="small" className="mr-2" />}
                    <Text className="text-white font-bold text-[15px]">{isSubmitting ? 'Submitting...' : 'Submit Request'}</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
          )}

          {/* Leave History Section */}
          <Text className="text-[#1F2937] text-lg font-bold mb-4 tracking-tight">Your Leave History</Text>
          
          {isLoading ? (
            <ActivityIndicator size="large" color="#145C44" className="mt-10" />
          ) : leaves.length > 0 ? (
            leaves.map(leave => (
              <View key={leave.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3">
                <View className="flex-row justify-between items-start mb-2">
                  <View>
                    <Text className="text-[#1F2937] font-bold">{new Date(leave.start_date).toLocaleDateString()} to {new Date(leave.end_date).toLocaleDateString()}</Text>
                    <Text className="text-gray-500 text-xs mt-1">Applied on {new Date(leave.created_at).toLocaleDateString()}</Text>
                  </View>
                  <View className={`px-2 py-1 rounded-md ${leave.status === 'Approved' ? 'bg-green-100' : leave.status === 'Rejected' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                    <Text className={`text-[10px] font-bold ${leave.status === 'Approved' ? 'text-green-700' : leave.status === 'Rejected' ? 'text-red-700' : 'text-yellow-700'}`}>{leave.status || 'Pending'}</Text>
                  </View>
                </View>
                <Text className="text-[#4B5563] text-sm mt-2 leading-relaxed">{leave.reason}</Text>
              </View>
            ))
          ) : (
            <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-200 border-dashed py-14 items-center justify-center">
              <Feather name="calendar" size={32} color="#9CA3AF" className="mb-4" />
              <Text className="text-[#4B5563] text-sm mt-3">You haven't requested any leaves yet.</Text>
            </View>
          )}
          
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default EmployeeLeaveScreen;
