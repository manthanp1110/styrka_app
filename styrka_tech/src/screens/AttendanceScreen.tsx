import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const MetricCard = ({ title, value, icon, iconBgColor, iconColor }: any) => (
  <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm shadow-gray-200 border border-gray-100" style={{ width: '48%' }}>
    <View className="flex-row items-center justify-between">
      <View className={`w-12 h-12 rounded-2xl items-center justify-center ${iconBgColor}`}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <View className="items-end flex-1 pl-2">
        <Text className="text-[10px] font-extrabold text-gray-500 uppercase text-right tracking-wide">{title}</Text>
        <Text className="text-3xl font-extrabold text-[#1F2937] mt-1">{value}</Text>
      </View>
    </View>
  </View>
);

const AttendanceRow = ({ name, email, status }: any) => {
  const initial = name?.charAt(0) || 'U';
  
  let statusBg = 'bg-yellow-100';
  let statusText = 'text-yellow-700';
  let statusIcon: any = 'clock';

  if (status === 'Punched Out') {
    statusBg = 'bg-emerald-100';
    statusText = 'text-emerald-700';
    statusIcon = 'check-circle';
  } else if (status === 'Absent') {
    statusBg = 'bg-red-100';
    statusText = 'text-red-700';
    statusIcon = 'alert-circle';
  }

  return (
    <View className="flex-row items-center py-4 border-b border-gray-50">
      <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mr-3">
        <Text className="text-emerald-800 font-bold text-lg">{initial}</Text>
      </View>
      <View className="flex-1 pr-2">
        <Text className="text-[#1F2937] font-bold text-[13px]">{name}</Text>
        <Text className="text-gray-400 text-[11px] mt-0.5" numberOfLines={1}>{email}</Text>
      </View>
      <View className={`${statusBg} px-3 py-2 rounded-full flex-row items-center`}>
        <Feather name={statusIcon} size={12} className={statusText} color={statusBg === 'bg-yellow-100' ? '#A16207' : statusBg === 'bg-emerald-100' ? '#047857' : '#B91C1C'} />
        <Text className={`font-bold text-[10px] ml-1.5 ${statusText}`}>{status}</Text>
      </View>
    </View>
  );
};

const AttendanceScreen = () => {
  const { logout, user } = useAppState();
  const [tab, setTab] = useState('All');
  
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all employees
      const { data: employees, error: empError } = await supabase.from('users').select('id, name, email').eq('role', 'employee');
      if (empError) throw empError;

      // 2. Fetch today's attendance records
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: attendance, error: attError } = await supabase
        .from('daily_attendance')
        .select('*')
        .gte('created_at', todayStart.toISOString());
      
      if (attError) throw attError;

      // 3. Map attendance to employees
      const attMap = (attendance || []).reduce((acc: any, record: any) => {
        acc[record.user_id] = record;
        return acc;
      }, {});

      const finalData = (employees || []).map(emp => {
        const record = attMap[emp.id];
        let status = 'Absent';
        if (record) {
          status = record.punch_out_time ? 'Punched Out' : 'Punched In';
        }
        return {
          ...emp,
          status,
          record
        };
      });

      setAttendanceData(finalData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const filteredData = attendanceData.filter(d => tab === 'All' ? true : d.status === tab);

  const currentlyIn = attendanceData.filter(d => d.status === 'Punched In').length;
  const punchedOut = attendanceData.filter(d => d.status === 'Punched Out').length;
  const absent = attendanceData.filter(d => d.status === 'Absent').length;

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
        <View className="px-5 pt-6 pb-4">
          <Text className="text-3xl font-bold text-[#1F2937]">Attendance</Text>
        </View>

        {/* Metrics Grid */}
        <View className="px-5 flex-row flex-wrap justify-between mb-4">
          <MetricCard title="CURRENTLY IN" value={currentlyIn} icon="clock" iconBgColor="bg-amber-100" iconColor="#D97706" />
          <MetricCard title="PUNCHED OUT" value={punchedOut} icon="check-circle" iconBgColor="bg-emerald-100" iconColor="#059669" />
          <MetricCard title="ABSENT TODAY" value={absent} icon="alert-circle" iconBgColor="bg-red-100" iconColor="#DC2626" />
          <MetricCard title="AVG HOURS" value="—" icon="calendar" iconBgColor="bg-gray-100" iconColor="#4B5563" />
        </View>

        {/* Live Status Indicator */}
        <View className="px-5 flex-row items-center mb-6">
          <View className="w-2.5 h-2.5 rounded-full bg-[#10B981] mr-2" />
          <Text className="text-[#4B5563] text-sm font-semibold">Live — updates automatically as employees punch in/out</Text>
        </View>

        {/* Today's Attendance List */}
        <View className="mx-5 bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-100 p-6 mb-6">
          <Text className="text-xl font-bold text-[#1F2937] mb-5">Today's Attendance</Text>
          
          {/* Tabs */}
          <View className="flex-row bg-[#F3F4F6] self-start rounded-xl p-1 mb-6">
            {['All', 'Punched In', 'Punched Out', 'Absent'].map(t => (
              <TouchableOpacity 
                key={t} 
                onPress={() => setTab(t)}
                className={`px-3 py-2 rounded-lg ${tab === t ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`font-bold text-xs ${tab === t ? 'text-[#1F2937]' : 'text-gray-500'}`}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Table Header */}
          <View className="flex-row border-b border-gray-100 pb-3 mb-2">
            <Text className="flex-1 text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">EMPLOYEE</Text>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider pr-1">STATUS</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#0F4C3A" className="mt-5" />
          ) : filteredData.length > 0 ? (
            filteredData.map(emp => (
              <AttendanceRow key={emp.id} name={emp.name} email={emp.email} status={emp.status} />
            ))
          ) : (
            <View className="items-center py-10">
              <Text className="text-gray-500">No records found.</Text>
            </View>
          )}
          
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default AttendanceScreen;
