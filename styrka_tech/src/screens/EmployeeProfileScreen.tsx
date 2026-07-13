import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const StatBox = ({ value, label, icon, emoji, bgColor, textColor }: any) => (
  <View className={`rounded-xl p-3 mb-3 ${bgColor}`} style={{ width: '48%' }}>
    {icon ? (
      <View className="mb-2">
        {emoji ? <Text className="text-xl">{emoji}</Text> : <Feather name={icon} size={20} color="gray" />}
      </View>
    ) : null}
    <Text className={`text-xl font-bold ${textColor}`}>{value}</Text>
    <Text className={`text-xs mt-0.5 ${textColor}`}>{label}</Text>
  </View>
);

const LogCard = ({ dateObj, fullDate, punchText, isInitiallyExpanded = false }: any) => {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  return (
    <View className="bg-white rounded-3xl mb-4 shadow-sm shadow-gray-200 border border-gray-100 overflow-hidden">
      {/* Collapsed Header */}
      <View className="p-4 flex-row">
        {/* Date Box */}
        <View className="bg-[#F3F4F6] rounded-xl items-center justify-center w-14 h-14 mr-4">
          <Text className="text-[#1F2937] font-extrabold text-lg">{dateObj.day}</Text>
          <Text className="text-gray-500 font-bold text-[10px] uppercase">{dateObj.month}</Text>
        </View>

        {/* Content */}
        <View className="flex-1 justify-center">
          <Text className="text-[#1F2937] font-bold text-lg">{fullDate}</Text>
          <Text className="text-gray-500 text-sm mt-0.5">{punchText}</Text>
          
          <View className="flex-row items-center mt-3">
            <TouchableOpacity 
              onPress={() => setIsExpanded(!isExpanded)}
              className={`w-8 h-8 rounded-full items-center justify-center ${isExpanded ? 'bg-[#0F4C3A]' : 'bg-gray-50'}`}
            >
              <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={isExpanded ? 'white' : 'gray'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Expanded Content */}
      {isExpanded && (
        <View className="border-t border-gray-100 p-5 bg-[#F9FAFB] flex-row">
          {/* Today's Plan */}
          <View className="flex-[0.8] pr-4">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Today's Plan</Text>
            <View className="bg-white rounded-xl border border-gray-100 p-4 min-h-[100px] items-center justify-center shadow-sm shadow-gray-100">
              <Text className="text-gray-400 italic">No plan provided.</Text>
            </View>
          </View>

          {/* Daily Targets */}
          <View className="flex-[1.2]">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Daily Targets</Text>
            <View className="flex-row flex-wrap justify-between">
              <StatBox value="N/A" label="Farmer Visits" emoji="🌾" bgColor="bg-purple-100" textColor="text-purple-700" />
              <StatBox value="N/A" label="Dealer Visits" emoji="🏪" bgColor="bg-blue-100" textColor="text-blue-700" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const EmployeeProfileScreen = () => {
  const { logout } = useAppState();
  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute<RouteProp<any, any>>();
  const employee = route.params?.employee || { name: 'Unknown', email: 'unknown@example.com', id: '' };

  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ farmers: 0, dealers: 0, orders: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!employee.id) {
        setIsLoading(false);
        return;
      }
      try {
        // Fetch logs
        const { data: logs, error: logsError } = await supabase
          .from('daily_attendance')
          .select('*')
          .eq('user_id', employee.id)
          .order('created_at', { ascending: false });
        
        if (!logsError && logs) {
          setAttendanceLogs(logs);
        }

        // Fetch counts
        const [farmRes, dealRes, orderRes] = await Promise.all([
          supabase.from('farmers').select('id', { count: 'exact' }).eq('added_by', employee.id),
          supabase.from('dealers').select('id', { count: 'exact' }).eq('added_by', employee.id),
          supabase.from('dealer_deliveries').select('id', { count: 'exact' }).eq('reported_by', employee.id),
        ]);

        setStats({
          farmers: farmRes.count || 0,
          dealers: dealRes.count || 0,
          orders: orderRes.count || 0
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmployeeData();
  }, [employee.id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      {/* Custom Header */}
      <View className="bg-[#0F4C3A] flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-[#F59E0B] items-center justify-center shadow-sm border border-[#D97706]">
            <Text className="text-white font-bold text-lg">S</Text>
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
        <View className="px-5 pt-6 pb-4">
          <Text className="text-2xl font-bold text-[#1F2937]">Employee Directory</Text>
        </View>

        {/* Hero Profile Card */}
        <View className="bg-[#145C44] rounded-t-[32px] rounded-b-[24px] p-6 mb-6 overflow-hidden relative shadow-md shadow-gray-300 mx-5">
          <View className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#1A7356] opacity-40" />
          <View className="absolute -bottom-10 left-10 w-32 h-32 rounded-full bg-[#1A7356] opacity-40" />

          {/* Action Bar */}
          <View className="flex-row justify-between mb-8">
            <TouchableOpacity onPress={() => navigation.goBack()} className="flex-row items-center bg-[#186D51] px-4 py-2 rounded-xl border border-[#218F6B]">
              <Feather name="arrow-left" size={16} color="white" />
              <Text className="text-white font-bold text-sm ml-2">All Employees</Text>
            </TouchableOpacity>
          </View>

          {/* User Info */}
          <View className="mb-8">
            <View className="w-20 h-20 rounded-full bg-purple-500 items-center justify-center shadow-md shadow-gray-900 border-2 border-[#8B5CF6] mb-4">
              <Text className="text-white text-3xl font-bold">{employee.name?.charAt(0) || 'U'}</Text>
            </View>
            <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest uppercase mb-1">Employee Profile</Text>
            <Text className="text-white text-2xl font-extrabold mb-1">{employee.name}</Text>
            <Text className="text-emerald-100 text-sm mb-4">{employee.email}</Text>
            
            <View className="bg-emerald-100 px-3 py-1.5 rounded-full flex-row items-center self-start">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
              <Text className="text-emerald-700 font-bold text-xs">Active</Text>
            </View>
          </View>

          {/* Performance Metrics Grid */}
          <View className="flex-row flex-wrap justify-between">
            <View className="bg-[#2A755D] rounded-xl p-4 mb-4" style={{ width: '48%' }}>
              <Text className="text-lg mb-1">📅</Text>
              <Text className="text-white text-2xl font-extrabold">{attendanceLogs.length}</Text>
              <Text className="text-emerald-100 text-xs">Days Present</Text>
            </View>
            <View className="bg-[#2A755D] rounded-xl p-4 mb-4" style={{ width: '48%' }}>
              <Text className="text-lg mb-1">🌾</Text>
              <Text className="text-white text-2xl font-extrabold">{stats.farmers}</Text>
              <Text className="text-emerald-100 text-xs">Farmers Added</Text>
            </View>
            <View className="bg-[#2A755D] rounded-xl p-4" style={{ width: '48%' }}>
              <Text className="text-lg mb-1">🏪</Text>
              <Text className="text-white text-2xl font-extrabold">{stats.dealers}</Text>
              <Text className="text-emerald-100 text-xs">Dealers Added</Text>
            </View>
            <View className="bg-[#2A755D] rounded-xl p-4" style={{ width: '48%' }}>
              <Text className="text-lg mb-1">📦</Text>
              <Text className="text-white text-2xl font-extrabold">{stats.orders}</Text>
              <Text className="text-emerald-100 text-xs">Orders Logged</Text>
            </View>
          </View>
        </View>

        {/* Logs Section */}
        <View className="bg-white rounded-t-3xl pt-6 px-5 pb-10 min-h-[400px]">
          <View className="flex-row items-center mb-6">
            <View className="bg-emerald-50 w-10 h-10 rounded-xl items-center justify-center mr-3 border border-emerald-100">
              <Feather name="calendar" size={18} color="#047857" />
            </View>
            <View>
              <Text className="text-lg font-bold text-[#1F2937]">Attendance Log</Text>
              <Text className="text-gray-500 text-sm">{attendanceLogs.length} records found</Text>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#0F4C3A" className="mt-10" />
          ) : attendanceLogs.length > 0 ? (
            attendanceLogs.map((log, idx) => {
              const d = new Date(log.created_at);
              const day = d.getDate();
              const month = d.toLocaleString('default', { month: 'short' });
              const fullDate = d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
              let punchText = `Punched in at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              if (log.punch_out_time) {
                const po = new Date(log.punch_out_time);
                punchText += ` • Out at ${po.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              }

              return (
                <LogCard 
                  key={log.id}
                  dateObj={{ day, month }}
                  fullDate={fullDate}
                  punchText={punchText}
                  isInitiallyExpanded={idx === 0}
                />
              );
            })
          ) : (
            <View className="items-center py-10 border border-gray-100 rounded-2xl bg-gray-50">
              <Text className="text-gray-500">No attendance records found.</Text>
            </View>
          )}

        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default EmployeeProfileScreen;
