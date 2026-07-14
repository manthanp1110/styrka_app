import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp, FadeInLeft } from 'react-native-reanimated';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const QuickActionButton = ({ title, iconName, bgColor, onPress, index = 0 }: { title: string, iconName: any, bgColor: string, onPress?: () => void, index?: number }) => (
  <View style={{ width: '47%', marginBottom: 16 }}>
    <TouchableOpacity 
      onPress={onPress} 
      className={`items-center px-4 py-5 rounded-3xl ${bgColor} shadow-sm border border-black/5`}
      activeOpacity={0.8}
    >
      <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mb-3">
        <Feather name={iconName} size={22} color="white" />
      </View>
      <Text className="text-white font-bold text-center text-[13px] tracking-wide">{title}</Text>
    </TouchableOpacity>
  </View>
);

const EmployeeDashboard = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const { logout, user } = useAppState();
  const [activeTaskTab, setActiveTaskTab] = useState('All');
  
  const [attendance, setAttendance] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch Today's Attendance
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: attData, error: attError } = await supabase
          .from('daily_attendance')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!attError && attData) {
          setAttendance(attData);
        }

        // Fetch Tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', user.id)
          .order('created_at', { ascending: false });
        
        if (!tasksError && tasksData) {
          setTasks(tasksData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    if (user.id) {
      fetchDashboardData();
    }
  }, [user.id]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
      if (error) throw error;
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (e: any) {
      alert("Failed to update task: " + e.message);
    }
  };

  const filteredTasks = tasks.filter(t => activeTaskTab === 'All' ? true : t.status === activeTaskTab);
  const pendingCount = tasks.filter(t => t.status === 'Pending').length;

  let attendanceStatus = 'Absent';
  let attendanceSub = 'Not punched in';
  if (attendance) {
    if (attendance.punch_out_time) {
      attendanceStatus = 'Punched Out';
      attendanceSub = new Date(attendance.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      attendanceStatus = 'Punched In';
      attendanceSub = new Date(attendance.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
      {/* Header */}
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

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-6 pb-2">
          <Text className="text-2xl font-bold text-[#1F2937] mb-4">Welcome back, {user.name?.split(' ')[0] || 'Team'}!</Text>
          
          {/* Top Row Stat Cards */}
          <View className="flex-row justify-between mb-4">
            <Animated.View entering={FadeInLeft.delay(100).springify()} className="flex-1 bg-white rounded-2xl p-4 shadow-sm shadow-gray-200 border border-gray-100 mr-2 flex-row items-start">
              <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 mt-1 ${attendanceStatus === 'Absent' ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <Feather name="clock" size={18} color={attendanceStatus === 'Absent' ? "#EF4444" : "#10B981"} />
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-[10px] font-bold tracking-wider mb-1 uppercase">TODAY'S{'\n'}ATTENDANCE</Text>
                <Text className="text-[#1F2937] text-xl font-black mb-1">{attendanceStatus}</Text>
                <Text className="text-gray-400 text-[10px]" numberOfLines={1}>{attendanceSub}</Text>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInLeft.delay(200).springify()} className="flex-1 bg-white rounded-2xl p-4 shadow-sm shadow-gray-200 border border-gray-100 ml-2 flex-row items-start">
              <View className="w-10 h-10 rounded-xl bg-orange-50 items-center justify-center mr-3 mt-1">
                <Feather name="check-square" size={18} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-[10px] font-bold tracking-wider mb-1 uppercase">PENDING{'\n'}TASKS</Text>
                <Text className="text-[#1F2937] text-xl font-black mb-1">{pendingCount}</Text>
              </View>
            </Animated.View>
          </View>

          {/* Leave Balance Card */}
          <Animated.View entering={FadeInLeft.delay(300).springify()} className="w-1/2 pr-2 mb-6">
            <View className="bg-white rounded-2xl p-4 shadow-sm shadow-gray-200 border border-gray-100 flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
                <Feather name="clipboard" size={18} color="#3B82F6" />
              </View>
              <View>
                <Text className="text-gray-500 text-[10px] font-bold tracking-wider mb-1 uppercase">LEAVE{'\n'}BALANCE</Text>
                <Text className="text-[#1F2937] text-xl font-black">12 Days</Text>
              </View>
            </View>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View entering={FadeInUp.delay(400).springify()} className="bg-white rounded-[32px] shadow-sm shadow-gray-200 border border-gray-100 overflow-hidden pt-1 pb-4 mb-6">
            <View className="px-6 py-5 border-b border-gray-50 flex-row justify-between items-center">
              <Text className="text-xl font-black text-[#1F2937] tracking-tight">Quick Actions</Text>
              <Feather name="zap" size={20} color="#F59E0B" />
            </View>
            <View className="px-5 pt-6 flex-row flex-wrap justify-between">
              <QuickActionButton index={0} title="Punch IN" iconName="log-in" bgColor="bg-[#10B981]" onPress={() => navigation.navigate('Attendance')} />
              <QuickActionButton index={1} title="Apply Leave" iconName="clipboard" bgColor="bg-[#065F46]" onPress={() => navigation.navigate('Leave')} />
              <QuickActionButton index={2} title="Add Farmer" iconName="user-plus" bgColor="bg-[#F59E0B]" onPress={() => navigation.navigate('My Farmers')} />
              <QuickActionButton index={3} title="Log Order" iconName="shopping-cart" bgColor="bg-[#8B5CF6]" onPress={() => navigation.navigate('Log Delivery')} />
              <QuickActionButton index={4} title="Destinations" iconName="map-pin" bgColor="bg-purple-600" onPress={() => navigation.navigate('EmployeeDestination')} />
              <QuickActionButton index={5} title="Live Tracking" iconName="navigation" bgColor="bg-emerald-600" onPress={() => navigation.navigate('LiveTracking')} />
            </View>
          </Animated.View>

          {/* My Assigned Tasks */}
          <Animated.View entering={FadeInUp.delay(500).springify()} className="bg-white rounded-2xl shadow-sm shadow-gray-200 border border-gray-100 mb-6">
            <View className="px-5 pt-4 pb-2">
              <Text className="text-lg font-bold text-[#1F2937] mb-3">My Assigned Tasks</Text>
              <View className="flex-row items-center bg-gray-50 rounded-lg self-start p-1 mb-4">
                {['All', 'Pending', 'Completed'].map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTaskTab(tab)}
                    className={`px-4 py-1.5 rounded-md ${
                      activeTaskTab === tab 
                        ? 'bg-white shadow-sm shadow-gray-200' 
                        : 'bg-transparent'
                    }`}
                  >
                    <Text 
                      className={`font-bold text-xs ${
                        activeTaskTab === tab ? 'text-[#1F2937]' : 'text-gray-500'
                      }`}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View className="px-5 pb-5">
              {isLoading ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : filteredTasks.length > 0 ? (
                filteredTasks.map((task, index) => (
                  <Animated.View key={task.id} entering={FadeInDown.delay(600 + (index * 100)).springify()} className="border border-gray-200 rounded-xl p-4 mb-3">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-[#1F2937] font-bold flex-1 pr-2">{task.title}</Text>
                      <View className={`px-2 py-1 rounded-md h-6 justify-center ${task.status === 'Completed' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        <Text className={`text-[10px] font-bold ${task.status === 'Completed' ? 'text-emerald-700' : 'text-amber-700'}`}>{task.status}</Text>
                      </View>
                    </View>
                    <Text className="text-gray-500 text-sm mb-3">{task.description}</Text>
                    {task.status !== 'Completed' && (
                      <TouchableOpacity 
                        onPress={() => updateTaskStatus(task.id, 'Completed')}
                        className="bg-emerald-50 border border-emerald-200 py-2 rounded-lg items-center"
                      >
                        <Text className="text-emerald-700 font-bold text-xs">Mark as Completed</Text>
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                ))
              ) : (
                <View className="border-t border-gray-100 py-6 items-center">
                  <Text className="text-gray-400 font-medium">No tasks found. Good job!</Text>
                </View>
              )}
            </View>
          </Animated.View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EmployeeDashboard;
