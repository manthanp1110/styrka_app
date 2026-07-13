import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { useNavigation, NavigationProp } from '@react-navigation/native';

type OptionItemProps = {
  iconName: any;
  title: string;
  isHighlighted?: boolean;
  onPress: () => void;
};

const OptionItem = ({ iconName, title, isHighlighted, onPress }: OptionItemProps) => (
  <TouchableOpacity 
    onPress={onPress}
    className={`flex-row items-center px-4 py-4 rounded-2xl mb-3 border ${
      isHighlighted 
        ? 'bg-[#F0FDF4] border-[#D1FAE5]' // Light green background for highlighted
        : 'bg-[#F9FAFB] border-[#F3F4F6]' // Light gray for normal
    }`}
  >
    <Feather 
      name={iconName} 
      size={20} 
      color={isHighlighted ? '#047857' : '#1F2937'} 
    />
    <Text 
      className={`ml-4 font-bold text-base ${
        isHighlighted ? 'text-[#047857]' : 'text-[#1F2937]'
      }`}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

const GridOption = ({ iconName, title, onPress }: any) => (
  <View className="items-center w-1/4 mb-6">
    <TouchableOpacity onPress={onPress} className="w-14 h-14 bg-gray-50 rounded-2xl items-center justify-center mb-2 shadow-sm shadow-gray-100">
      <Feather name={iconName} size={22} color="#4B5563" />
    </TouchableOpacity>
    <Text className="text-[11px] font-semibold text-gray-700 text-center">{title}</Text>
  </View>
);

const MoreOptionsModal = () => {
  const { user, isMoreModalVisible, setMoreModalVisible } = useAppState();
  const navigation = useNavigation<NavigationProp<any>>();

  const handleClose = () => setMoreModalVisible(false);

  const handleNavigate = (screenName: string) => {
    handleClose();
    setTimeout(() => {
      navigation.navigate(screenName);
    }, 150);
  };

  const isAdmin = user.role === 'admin';

  return (
    <Modal
      visible={isMoreModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      {/* Dark Overlay Background */}
      <View className="flex-1 bg-black/50 justify-end">
        <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={handleClose} />

        <View className="bg-white rounded-t-3xl pt-6 px-6 pb-10 shadow-xl" style={{ maxHeight: '85%' }}>
          
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-[#111827]">
              {isAdmin ? 'More Options' : 'More Sections'}
            </Text>
            <TouchableOpacity onPress={handleClose} className="bg-[#F3F4F6] w-8 h-8 rounded-full items-center justify-center">
              <Feather name={isAdmin ? "x" : "chevron-up"} size={16} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {isAdmin ? (
              // Admin List Layout
              <>
                <OptionItem iconName="map-pin" title="Live Tracking" onPress={handleClose} />
                <OptionItem iconName="navigation" title="Journey Logs" onPress={handleClose} />
                <OptionItem iconName="droplet" title="Mileage & Expenses" onPress={handleClose} />
                <OptionItem iconName="clipboard" title="Leave Requests" onPress={() => handleNavigate('LeaveRequests')} />
                
                <OptionItem 
                  iconName="user-plus" 
                  title="Add Employee" 
                  isHighlighted 
                  onPress={() => handleNavigate('AddEmployee')} 
                />
                
                <OptionItem iconName="check-square" title="Assign Task" onPress={() => handleNavigate('AssignTask')} />
                <OptionItem iconName="message-circle" title="Chat" onPress={() => handleNavigate('Chat')} />
                <OptionItem iconName="file-text" title="Farmers" onPress={() => handleNavigate('Farmers')} />
                <OptionItem iconName="home" title="Dealers" onPress={() => handleNavigate('Dealers')} />
              </>
            ) : (
              // Employee Vertical List Layout
              <>
                <OptionItem iconName="calendar" title="Attendance" onPress={() => handleNavigate('Attendance')} />
                <OptionItem iconName="map-pin" title="Live Routing" onPress={handleClose} />
                <OptionItem iconName="message-circle" title="Chat" onPress={() => handleNavigate('Chat')} />
                <OptionItem iconName="shopping-cart" title="Orders" onPress={() => handleNavigate('Orders')} />
                <OptionItem iconName="image" title="Gallery" onPress={handleClose} />
                <OptionItem iconName="file-text" title="Reports" onPress={handleClose} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default MoreOptionsModal;
