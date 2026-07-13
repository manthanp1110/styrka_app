import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const ChatScreen = () => {
  const { logout, user } = useAppState();
  const [activeChat, setActiveChat] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchChatData = async () => {
    try {
      const [empRes, msgRes] = await Promise.all([
        supabase.from('users').select('id, name, email').eq('role', 'employee'),
        supabase.from('chat_messages')
          .select('*')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: true })
      ]);

      if (empRes.data) setEmployees(empRes.data);
      if (msgRes.data) setAllMessages(msgRes.data);

      if (activeChat) {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user.id) {
      fetchChatData();
      const interval = setInterval(() => {
        fetchChatData();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [user.id, activeChat?.id]);

  const sendMessage = async () => {
    if (!messageText.trim() || !activeChat) return;

    const msg = messageText.trim();
    setMessageText('');

    try {
      const { error } = await supabase.from('chat_messages').insert([
        {
          sender_id: user.id,
          receiver_id: activeChat.id,
          message: msg
        }
      ]);
      if (error) throw error;
      fetchChatData();
    } catch (e: any) {
      alert("Failed to send: " + e.message);
    }
  };

  // Group contacts
  const contacts = employees.map(emp => {
    const empMessages = allMessages.filter(m => m.sender_id === emp.id || m.receiver_id === emp.id);
    const lastMessage = empMessages.length > 0 ? empMessages[empMessages.length - 1] : null;
    
    return {
      ...emp,
      initial: emp.name ? emp.name.charAt(0) : 'U',
      lastMessage: lastMessage ? (lastMessage.sender_id === user.id ? `You: ${lastMessage.message}` : lastMessage.message) : 'Start a conversation',
      time: lastMessage ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    };
  });

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeChatMessages = activeChat ? allMessages.filter(m => m.sender_id === activeChat.id || m.receiver_id === activeChat.id) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F4C3A' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

        {/* Main Content Area */}
        <View style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
          
          {/* Title & Hero Card */}
          <View className={`px-5 pt-6 ${activeChat ? 'pb-2' : 'pb-4'}`}>
            <Text className="text-2xl font-extrabold text-[#1F2937] mb-4">Chat</Text>
            {!activeChat && (
              <View className="bg-[#145C44] rounded-3xl p-6 relative overflow-hidden shadow-sm shadow-gray-300">
                <View className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#1A7356] opacity-50" />
                <Text className="text-[#F59E0B] text-[10px] font-bold tracking-widest uppercase mb-1">Communications</Text>
                <Text className="text-white text-3xl font-extrabold mb-1">Team Chat</Text>
                <Text className="text-emerald-100 text-sm mb-4">Instant messaging with employees</Text>
              </View>
            )}
          </View>

          {/* Dynamic Views */}
          {!activeChat ? (
            /* ----- LIST VIEW ----- */
            <View className="flex-1 px-5">
              <Text className="text-[#1F2937] text-xl font-extrabold mb-4">Conversations</Text>
              
              <View className="bg-white flex-row items-center rounded-2xl px-4 py-3 mb-4 shadow-sm shadow-gray-200 border border-gray-100">
                <Feather name="search" size={18} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-base text-[#1F2937]"
                  placeholder="Search employees..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {isLoading ? (
                <ActivityIndicator size="large" color="#145C44" className="mt-10" />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-100">
                    {filteredContacts.map((contact, index) => (
                      <TouchableOpacity 
                        key={contact.id}
                        onPress={() => setActiveChat(contact)}
                        className={`flex-row items-center p-4 ${index !== filteredContacts.length - 1 ? 'border-b border-gray-100' : ''}`}
                      >
                        <View className="w-14 h-14 rounded-full bg-orange-400 items-center justify-center mr-4 shadow-sm shadow-gray-300">
                          <Text className="text-white text-2xl font-bold">{contact.initial}</Text>
                        </View>
                        <View className="flex-1 pr-2">
                          <Text className="text-[#1F2937] text-base font-bold mb-0.5" numberOfLines={1}>{contact.name}</Text>
                          <Text className="text-gray-500 text-sm" numberOfLines={1}>{contact.lastMessage}</Text>
                        </View>
                        {contact.time ? (
                          <Text className="text-gray-400 text-xs">{contact.time}</Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                    {filteredContacts.length === 0 && (
                      <View className="p-8 items-center">
                        <Text className="text-gray-500">No employees found.</Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              )}
            </View>
          ) : (
            /* ----- DETAIL VIEW ----- */
            <View className="flex-1 bg-white rounded-t-3xl shadow-lg shadow-gray-300 mx-4 border border-gray-100 mt-2">
              
              {/* Chat Header */}
              <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
                <View className="flex-row items-center">
                  <TouchableOpacity onPress={() => setActiveChat(null)} className="p-2 mr-2 bg-gray-100 rounded-full">
                    <Feather name="arrow-left" size={20} color="#1F2937" />
                  </TouchableOpacity>
                  <View className="w-10 h-10 rounded-full bg-orange-400 items-center justify-center mr-3 shadow-sm shadow-gray-300">
                    <Text className="text-white text-lg font-bold">{activeChat.initial}</Text>
                  </View>
                  <View>
                    <Text className="text-[#1F2937] text-sm font-bold uppercase tracking-wide w-40" numberOfLines={2}>{activeChat.name}</Text>
                    <View className="flex-row items-center mt-0.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-[#10B981] mr-1.5" />
                      <Text className="text-[#10B981] text-xs font-bold">Online</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Chat Messages */}
              <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                {activeChatMessages.map((msg, idx) => {
                  const isMe = msg.sender_id === user.id;

                  return (
                    <View key={msg.id} className={`flex-row items-end mb-4 ${isMe ? 'justify-end' : ''}`}>
                      {!isMe && (
                        <View className="w-8 h-8 rounded-full bg-orange-400 items-center justify-center mr-2 shadow-sm">
                          <Text className="text-white text-sm font-bold">{activeChat.initial}</Text>
                        </View>
                      )}
                      
                      <View className={`rounded-2xl px-4 py-3 shadow-sm max-w-[80%] ${isMe ? 'bg-[#145C44] rounded-tr-sm border border-[#0F4C3A]' : 'bg-white rounded-tl-sm shadow-gray-200 border border-gray-100'}`}>
                        <Text className={`text-base mb-1 ${isMe ? 'text-white' : 'text-[#1F2937]'}`}>{msg.message}</Text>
                        <Text className={`text-[10px] text-right mt-1 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>

                      {isMe && (
                        <View className="w-8 h-8 rounded-full bg-[#F59E0B] items-center justify-center ml-2 shadow-sm">
                          <Text className="text-white text-sm font-bold">{user.name?.charAt(0) || 'A'}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                {activeChatMessages.length === 0 && (
                  <View className="items-center mt-10">
                    <Text className="text-gray-400">No messages yet. Send one to start!</Text>
                  </View>
                )}
              </ScrollView>

              {/* Input Area */}
              <View className="p-4 bg-white border-t border-gray-100 flex-row items-center">
                <View className="flex-1 bg-white border border-gray-300 rounded-full flex-row items-center px-4 py-2 mr-3 shadow-sm shadow-gray-100">
                  <TextInput
                    className="flex-1 text-[#1F2937] text-base py-1"
                    placeholder="Type your message..."
                    placeholderTextColor="#9CA3AF"
                    value={messageText}
                    onChangeText={setMessageText}
                    onSubmitEditing={sendMessage}
                  />
                </View>
                <TouchableOpacity 
                  onPress={sendMessage}
                  disabled={!messageText.trim()}
                  className={`w-12 h-12 rounded-full flex-row items-center justify-center shadow-sm border ${messageText.trim() ? 'bg-[#145C44] border-[#0F4C3A]' : 'bg-gray-100 border-gray-200'}`}
                >
                  <Feather name="send" size={18} color={messageText.trim() ? "white" : "#4B5563"} className="ml-0.5 mt-0.5" />
                </TouchableOpacity>
              </View>

            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
