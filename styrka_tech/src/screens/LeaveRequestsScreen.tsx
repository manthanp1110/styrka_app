import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const MetricBox = ({ label, value, colorClass }: any) => (
  <View className="bg-white rounded-2xl p-4 items-center justify-center shadow-sm shadow-gray-200 border border-gray-100 flex-1 mx-1">
    <Text className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest mb-2">{label}</Text>
    <Text className={`text-3xl font-black ${colorClass}`}>{value}</Text>
  </View>
);

const EmptyStateCard = ({ message }: { message: string }) => (
  <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-200 border-dashed py-16 items-center justify-center mt-2 mx-5">
    <Feather name="calendar" size={40} color="#9CA3AF" className="mb-4" />
    <Text className="text-gray-500 font-semibold text-base mt-4">{message}</Text>
  </View>
);

const LeaveRequestCard = ({ request, onUpdateStatus }: any) => (
  <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-100 p-5 mt-2 mx-5 mb-5">
    {/* Header */}
    <View className="flex-row items-start justify-between mb-5">
      <View className="flex-row items-center flex-1">
        <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-3">
          <Text className="text-[#0F4C3A] text-xl font-bold">{request.user?.name ? request.user.name.charAt(0) : 'U'}</Text>
        </View>
        <View className="flex-1 pr-2">
          <Text className="text-[#1F2937] text-base font-bold mb-0.5">{request.user?.name || 'Unknown Employee'}</Text>
          <Text className="text-gray-400 text-xs">{request.user?.email || 'No email'}</Text>
        </View>
      </View>
      
      <View className={`px-3 py-1.5 rounded-full flex-row items-center border ${request.status === 'Approved' ? 'bg-emerald-50 border-emerald-100' : request.status === 'Rejected' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
        {request.status === 'Approved' ? <Feather name="check-circle" size={14} color="#059669" /> : null}
        <Text className={`font-bold text-xs ${request.status === 'Approved' ? 'text-emerald-700 ml-1.5' : request.status === 'Rejected' ? 'text-red-700' : 'text-amber-700'} uppercase tracking-wider`}>
          {request.status}
        </Text>
      </View>
    </View>

    {/* Date Range Box */}
    <View className="bg-[#F9FAFB] rounded-xl border border-gray-100 p-4 flex-row items-center justify-center mb-5">
      <Feather name="calendar" size={16} color="#4B5563" />
      <Text className="text-[#1F2937] font-bold text-[15px] ml-3">{new Date(request.start_date).toLocaleDateString()}</Text>
      <Feather name="arrow-right" size={14} color="#9CA3AF" className="mx-3" />
      <Text className="text-[#1F2937] font-bold text-[15px]">{new Date(request.end_date).toLocaleDateString()}</Text>
    </View>

    {/* Reason */}
    <View className="mb-6">
      <Text className="text-gray-500 font-extrabold text-[10px] uppercase tracking-widest mb-2">Reason</Text>
      <Text className="text-[#1F2937] text-sm">{request.reason}</Text>
    </View>

    {/* Footer actions for pending */}
    {request.status === 'Pending' && (
      <View className="flex-row justify-between mb-4 mt-2">
        <TouchableOpacity onPress={() => onUpdateStatus(request.id, 'Rejected')} className="flex-1 mr-2 bg-red-100 py-3 rounded-xl items-center border border-red-200">
          <Text className="text-red-700 font-bold">Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onUpdateStatus(request.id, 'Approved')} className="flex-1 ml-2 bg-emerald-600 py-3 rounded-xl items-center border border-emerald-700">
          <Text className="text-white font-bold">Approve</Text>
        </TouchableOpacity>
      </View>
    )}

    {/* Footer */}
    <View className="border-t border-gray-100 pt-4 items-center">
      <Text className="text-gray-400 text-xs font-medium">Requested on {new Date(request.created_at).toLocaleDateString()}</Text>
    </View>
  </View>
);

const LeaveRequestsScreen = () => {
  const { logout, user } = useAppState();
  const [activeTab, setActiveTab] = useState('Pending');
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const { data: leaveData, error: leaveError } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
      if (leaveError) throw leaveError;

      const { data: userData, error: userError } = await supabase.from('users').select('id, name, email');
      if (userError) throw userError;

      const userMap = (userData || []).reduce((acc: any, u: any) => {
        acc[u.id] = u;
        return acc;
      }, {});

      const mergedData = (leaveData || []).map(r => ({ ...r, user: userMap[r.user_id] }));
      setRequests(mergedData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
      if (error) throw error;
      fetchRequests(); // refresh list
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredRequests = requests.filter(r => activeTab === 'All' ? true : r.status === activeTab);
  
  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const approvedCount = requests.filter(r => r.status === 'Approved').length;
  const rejectedCount = requests.filter(r => r.status === 'Rejected').length;

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
        <View className="px-5 pt-6 pb-6">
          <Text className="text-3xl font-extrabold text-[#1F2937] mb-2 tracking-tight">Leave Requests</Text>
          <Text className="text-gray-500 text-base">Review and manage employee time off.</Text>
        </View>

        {/* Tabs */}
        <View className="px-5 mb-6">
          <View className="flex-row bg-white rounded-2xl p-1.5 shadow-sm shadow-gray-100 border border-gray-100">
            {['Pending', 'Approved', 'Rejected', 'All'].map(tab => (
              <TouchableOpacity 
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl items-center ${activeTab === tab ? 'bg-emerald-50' : 'bg-transparent'}`}
              >
                <Text className={`font-bold text-sm ${activeTab === tab ? 'text-[#0F4C3A]' : 'text-gray-500'}`}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Metrics Grid */}
        <View className="px-4 flex-row mb-6">
          <MetricBox label="PENDING" value={pendingCount.toString()} colorClass="text-[#D97706]" />
          <MetricBox label="APPROVED" value={approvedCount.toString()} colorClass="text-[#059669]" />
          <MetricBox label="REJECTED" value={rejectedCount.toString()} colorClass="text-[#DC2626]" />
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#145C44" className="mt-10" />
        ) : filteredRequests.length > 0 ? (
          filteredRequests.map(r => (
            <LeaveRequestCard key={r.id} request={r} onUpdateStatus={handleUpdateStatus} />
          ))
        ) : (
          <EmptyStateCard message={`No ${activeTab.toLowerCase()} leave requests found.`} />
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default LeaveRequestsScreen;
