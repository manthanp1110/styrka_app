import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const EmployeeChatScreen = () => {
  const { logout, user } = useAppState();
  const navigation = useNavigation();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchAdminId = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single();
      
      if (!error && data) {
        setAdminId(data.id);
      }
    } catch (e) {
      console.error('Error fetching admin ID', e);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages(data || []);
      // Scroll to bottom
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user.id) {
      fetchAdminId();
      fetchMessages();
      
      // Simple polling for new messages every 3 seconds
      const interval = setInterval(() => {
        fetchMessages();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [user.id]);

  const sendMessage = async () => {
    if (!message.trim() || !adminId) return;

    const msgText = message.trim();
    setMessage(''); // Optimistic clear

    try {
      const { error } = await supabase.from('chat_messages').insert([
        {
          sender_id: user.id,
          receiver_id: adminId,
          message: msgText
        }
      ]);

      if (error) throw error;
      
      fetchMessages();
    } catch (e: any) {
      alert("Failed to send: " + e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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

        <View style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
          {/* Top Green Banner */}
          <View className="bg-[#145C44] rounded-b-[32px] px-6 pt-6 pb-10 relative overflow-hidden shadow-sm">
            {/* Decorative element */}
            <View className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-[#1A7356] opacity-30" />
            
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-white text-3xl font-extrabold mb-1 tracking-tight">Admin</Text>
                <Text className="text-emerald-100 text-sm w-48 leading-tight">Direct line to your administrator</Text>
              </View>
              
              <View className="bg-[#186D51] px-3 py-2 rounded-xl flex-row items-center border border-[#218F6B] mt-1 shadow-sm">
                <View className="w-2 h-2 rounded-full bg-[#34D399] mr-2" />
                <Text className="text-emerald-100 text-[10px] font-bold">Administrator{'\n'}Online</Text>
              </View>
            </View>
          </View>

          {/* Main Chat Container */}
          <View className="flex-1 bg-white mx-4 -mt-6 rounded-t-3xl shadow-md shadow-gray-300 border border-gray-100 overflow-hidden mb-4">
            
            {/* Chat Header */}
            <View className="flex-row items-center p-4 border-b border-gray-100 bg-white">
              <View className="w-12 h-12 rounded-full bg-amber-600 items-center justify-center mr-3 shadow-sm border border-amber-500">
                <Text className="text-white text-xl font-bold">A</Text>
              </View>
              <View>
                <Text className="text-[#1F2937] text-base font-extrabold mb-0.5">Administrator</Text>
                <View className="flex-row items-center">
                  <View className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5" />
                  <Text className="text-[#10B981] text-xs font-bold">Live Support</Text>
                </View>
              </View>
            </View>

            {/* Messages Area */}
            {isLoading ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#145C44" />
              </View>
            ) : (
              <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
                
                {/* Date Separator */}
                <View className="flex-row items-center justify-center mb-6 mt-2">
                  <View className="flex-1 h-px bg-gray-200" />
                  <View className="bg-white border border-gray-200 px-3 py-1 rounded-full mx-3 shadow-sm">
                    <Text className="text-[#4B5563] text-xs font-medium">Chat History</Text>
                  </View>
                  <View className="flex-1 h-px bg-gray-200" />
                </View>

                {messages.map((msg, index) => {
                  const isMe = msg.sender_id === user.id;

                  return (
                    <View key={msg.id} className={`flex-row items-end mb-4 ${isMe ? 'justify-end' : ''}`}>
                      {!isMe && (
                        <View className="w-8 h-8 rounded-full bg-amber-600 items-center justify-center mr-2 shadow-sm">
                          <Text className="text-white text-xs font-bold">A</Text>
                        </View>
                      )}
                      
                      <View className={`${isMe ? 'bg-[#145C44] rounded-tr-sm mr-2' : 'bg-white rounded-tl-sm shadow-gray-200 border border-gray-100'} rounded-2xl px-4 py-3 shadow-sm max-w-[70%]`}>
                        <Text className={`${isMe ? 'text-white' : 'text-[#1F2937]'} text-base mb-1`}>{msg.message}</Text>
                        <Text className={`${isMe ? 'text-emerald-200 text-right' : 'text-gray-400'} text-[10px]`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>

                      {isMe && (
                        <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center shadow-sm">
                          <Text className="text-white text-xs font-bold">{user.name?.charAt(0) || 'U'}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}

              </ScrollView>
            )}

            {/* Input Area */}
            <View className="p-4 bg-white border-t border-gray-100 flex-row items-center">
              <View className="flex-1 bg-white border border-gray-300 rounded-full flex-row items-center px-4 py-2 mr-3 shadow-sm shadow-gray-100">
                <TextInput
                  className="flex-1 text-[#1F2937] text-base py-1"
                  placeholder="Type your message..."
                  placeholderTextColor="#9CA3AF"
                  value={message}
                  onChangeText={setMessage}
                  onSubmitEditing={sendMessage}
                />
              </View>
              <TouchableOpacity 
                onPress={sendMessage}
                disabled={!message.trim()}
                className={`w-12 h-12 rounded-full flex-row items-center justify-center shadow-sm border ${message.trim() ? 'bg-[#145C44] border-[#0F4C3A]' : 'bg-gray-100 border-gray-200'}`}
              >
                <Feather name="send" size={18} color={message.trim() ? "white" : "#4B5563"} className="ml-0.5 mt-0.5" />
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EmployeeChatScreen;
