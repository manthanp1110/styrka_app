import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator, Modal, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const AssignTaskScreen = () => {
  const { logout, user } = useAppState();
  const [taskTitle, setTaskTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isEmployeeModalVisible, setEmployeeModalVisible] = useState(false);
  
  const [tasksStats, setTasksStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase.from('users').select('id, name, email').eq('role', 'employee');
      if (!error && data) {
        setEmployees(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTasksStats = async () => {
    setIsLoadingStats(true);
    try {
      const [pendingRes, completedRes] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact' }).neq('status', 'Completed'),
        supabase.from('tasks').select('id', { count: 'exact' }).eq('status', 'Completed')
      ]);

      setTasksStats({
        total: (pendingRes.count || 0) + (completedRes.count || 0),
        pending: pendingRes.count || 0,
        completed: completedRes.count || 0
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchTasksStats();
  }, []);

  const handleAssignTask = async () => {
    if (!taskTitle || !description || !selectedEmployee) {
      alert("Please fill in all fields and select an employee.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tasks').insert([
        {
          title: taskTitle,
          description: description,
          assigned_to: selectedEmployee.id,
          status: 'Pending'
        }
      ]);

      if (error) throw error;
      
      alert("Task assigned successfully!");
      setTaskTitle('');
      setDescription('');
      setSelectedEmployee(null);
      fetchTasksStats();
    } catch (e: any) {
      alert("Failed to assign task: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <Text className="text-2xl font-extrabold text-[#1F2937]">Assign Task</Text>
        </View>

        {/* Composite Form Card */}
        <View className="mx-5 mb-6 shadow-sm shadow-gray-200">
          {/* Top Half (Dark Green) */}
          <View className="bg-[#145C44] rounded-t-3xl p-6">
            <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest uppercase mb-1">Admin Panel</Text>
            <Text className="text-white text-2xl font-extrabold mb-1">Assign New Task</Text>
            <Text className="text-emerald-100 text-sm">Delegate work to a team member</Text>
          </View>
          
          {/* Bottom Half (White) */}
          <View className="bg-white rounded-b-3xl p-6 border-b border-l border-r border-gray-100">
            {/* Task Title Input */}
            <View className="mb-5">
              <Text className="text-[#1F2937] font-bold text-sm mb-2">Task Title</Text>
              <TextInput
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-[#1F2937]"
                placeholder="E.g., Update Q3 Reports"
                placeholderTextColor="#9CA3AF"
                value={taskTitle}
                onChangeText={setTaskTitle}
              />
            </View>

            {/* Assign To Pseudo-Dropdown */}
            <View className="mb-5">
              <Text className="text-[#1F2937] font-bold text-sm mb-2">Assign To</Text>
              <TouchableOpacity 
                onPress={() => setEmployeeModalVisible(true)}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
              >
                <Text className={`text-base ${selectedEmployee ? 'text-[#1F2937]' : 'text-gray-500'}`}>
                  {selectedEmployee ? selectedEmployee.name : '— Select an employee —'}
                </Text>
                <Feather name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Description Input */}
            <View className="mb-6">
              <Text className="text-[#1F2937] font-bold text-sm mb-2">Description</Text>
              <TextInput
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-[#1F2937]"
                placeholder="Describe the task in detail — goals, deadlines, context..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
                style={{ minHeight: 100 }}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              onPress={handleAssignTask}
              disabled={isSubmitting}
              className={`bg-[#145C44] rounded-xl py-4 flex-row items-center justify-center ${isSubmitting ? 'opacity-70' : ''}`}
            >
              {isSubmitting && <ActivityIndicator color="white" size="small" className="mr-2" />}
              <Text className="text-white font-bold text-base">{isSubmitting ? 'Assigning...' : 'Create & Assign Task'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Task Summary Card */}
        <View className="bg-white rounded-3xl mx-5 p-5 mb-6 shadow-sm shadow-gray-200 border border-gray-100">
          <View className="flex-row items-center mb-6">
            <View className="bg-emerald-50 px-2.5 py-1.5 rounded-lg mr-3">
              <Feather name="check-square" size={16} color="#047857" />
            </View>
            <Text className="text-lg font-bold text-[#1F2937]">Task Summary</Text>
          </View>

          {isLoadingStats ? (
            <ActivityIndicator size="small" color="#145C44" />
          ) : (
            <>
              <View className="flex-row justify-between border-b border-gray-100 pb-3 mb-3">
                <Text className="text-gray-500 font-semibold text-sm">Total Tasks</Text>
                <Text className="text-[#1F2937] font-bold text-lg">{tasksStats.total}</Text>
              </View>
              <View className="flex-row justify-between border-b border-gray-100 pb-3 mb-3">
                <Text className="text-gray-500 font-semibold text-sm">Pending</Text>
                <Text className="text-[#D97706] font-bold text-lg">{tasksStats.pending}</Text>
              </View>
              <View className="flex-row justify-between pb-1">
                <Text className="text-gray-500 font-semibold text-sm">Completed</Text>
                <Text className="text-[#059669] font-bold text-lg">{tasksStats.completed}</Text>
              </View>
            </>
          )}
        </View>

      </ScrollView>

      {/* Employee Selection Modal */}
      <Modal visible={isEmployeeModalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity className="absolute inset-0" onPress={() => setEmployeeModalVisible(false)} />
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="p-5 border-b border-gray-100 flex-row justify-between items-center">
              <Text className="text-xl font-bold text-[#1F2937]">Select Employee</Text>
              <TouchableOpacity onPress={() => setEmployeeModalVisible(false)} className="w-8 h-8 items-center justify-center bg-gray-100 rounded-full">
                <Feather name="x" size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={employees}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => {
                    setSelectedEmployee(item);
                    setEmployeeModalVisible(false);
                  }}
                  className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center justify-between"
                >
                  <View>
                    <Text className="text-base font-bold text-[#1F2937]">{item.name}</Text>
                    <Text className="text-gray-500 text-xs mt-1">{item.email}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="text-center text-gray-500 py-10">No employees found.</Text>
              }
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

export default AssignTaskScreen;
