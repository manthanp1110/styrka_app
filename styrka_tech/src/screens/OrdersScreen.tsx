import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';

const MetricCard = ({ title, value, icon, iconBgColor, iconColor, width = '48%' }: any) => (
  <View className="bg-white rounded-2xl p-5 shadow-sm shadow-gray-200 border border-gray-100 mb-4" style={{ width }}>
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

const OrderCard = ({ order }: any) => {
  return (
    <View className="bg-white rounded-3xl p-5 shadow-sm shadow-gray-200 border border-gray-100 mb-4 mx-5">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 pr-2">
          <Text className="text-[#1F2937] text-lg font-bold mb-1">{order.dealer_name}</Text>
          <View className="flex-row items-center">
            <Feather name="user" size={12} color="#6B7280" />
            <Text className="text-gray-500 text-xs ml-1">Rep: {order.employee_name || 'Unknown'}</Text>
          </View>
        </View>
        <View className={`px-2 py-1 rounded-md ${order.gst_type === 'GST' ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-100 border border-gray-200'}`}>
          <Text className={`text-[10px] font-bold ${order.gst_type === 'GST' ? 'text-emerald-700' : 'text-gray-600'}`}>{order.gst_type}</Text>
        </View>
      </View>
      
      <View className="bg-gray-50 rounded-xl p-3 flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Product</Text>
          <Text className="text-[#1F2937] font-semibold text-sm">{order.product_id} - {order.product_name}</Text>
        </View>
        <View className="items-end">
          <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Boxes</Text>
          <Text className="text-[#0F4C3A] font-black text-lg">{order.boxes}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center border-t border-gray-100 pt-3">
        <Text className="text-gray-400 text-xs">{new Date(order.delivered_at || order.created_at || Date.now()).toLocaleDateString()}</Text>
        <View className={`px-2 py-1 rounded-md ${order.order_type === 'Cash' ? 'bg-amber-50' : 'bg-blue-50'}`}>
          <Text className={`text-[10px] font-bold ${order.order_type === 'Cash' ? 'text-amber-700' : 'text-blue-700'}`}>{order.order_type}</Text>
        </View>
      </View>
    </View>
  );
};

const OrdersScreen = () => {
  const { logout } = useAppState();
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const { data: orderData, error: orderError } = await supabase.from('dealer_deliveries').select('*').order('created_at', { ascending: false });
        if (orderError) throw orderError;

        const { data: userData, error: userError } = await supabase.from('users').select('id, name');
        if (userError) throw userError;

        const userMap = (userData || []).reduce((acc: any, u: any) => {
          acc[u.id] = u.name;
          return acc;
        }, {});

        const mergedOrders = (orderData || []).map(o => ({
          ...o,
          employee_name: userMap[o.reported_by] || 'Unknown'
        }));

        setOrders(mergedOrders);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.dealer_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          o.product_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.employee_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (timeFilter === 'Today') {
      const today = new Date();
      const orderDate = new Date(o.created_at || o.delivered_at);
      return orderDate.toDateString() === today.toDateString();
    } else if (timeFilter === 'This Week') {
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const orderDate = new Date(o.created_at || o.delivered_at);
      return orderDate >= startOfWeek;
    }
    
    return true;
  });

  const totalBoxes = filteredOrders.reduce((sum, o) => sum + (parseInt(o.boxes) || 0), 0);
  const activeEmployees = new Set(filteredOrders.map(o => o.reported_by)).size;

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
          <Text className="text-3xl font-bold text-[#1F2937]">Orders</Text>
        </View>

        {/* Metrics Grid */}
        <View className="px-5">
          {/* Top Row */}
          <View className="flex-row justify-between">
            <MetricCard 
              title="ACTIVE EMPS" 
              value={activeEmployees.toString()} 
              icon="trending-up" 
              iconBgColor="bg-emerald-50" 
              iconColor="#047857" 
            />
            <MetricCard 
              title="TOTAL ORDERS" 
              value={filteredOrders.length.toString()} 
              icon="shopping-cart" 
              iconBgColor="bg-orange-50" 
              iconColor="#EA580C" 
            />
          </View>
          
          {/* Bottom Row (Full Width) */}
          <MetricCard 
            title="TOTAL BOXES" 
            value={totalBoxes.toString()} 
            icon="package" 
            iconBgColor="bg-purple-100" 
            iconColor="#7C3AED"
            width="100%" 
          />
        </View>

        {/* Search Bar */}
        <View className="px-5 mb-5 mt-2">
          <View className="flex-row items-center bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-sm shadow-gray-100">
            <Feather name="search" size={20} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-3 text-base text-[#1F2937]"
              placeholder="Search employee, dealer, product..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Time Filter Tabs */}
        <View className="px-5 mb-5">
          <View className="flex-row justify-between">
            {['Today', 'This Week', 'All Time'].map(tab => (
              <TouchableOpacity 
                key={tab} 
                onPress={() => setTimeFilter(tab)}
                className={`flex-1 py-3 rounded-xl items-center mx-1 ${
                  timeFilter === tab ? 'bg-white shadow-sm shadow-gray-200 border border-gray-100' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold text-sm ${
                  timeFilter === tab ? 'text-[#0F4C3A]' : 'text-gray-500'
                }`}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#0F4C3A" className="mt-10" />
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map(o => <OrderCard key={o.id} order={o} />)
        ) : (
          <View className="px-5">
            <View className="bg-white rounded-3xl shadow-sm shadow-gray-200 border border-gray-100 py-20 items-center justify-center">
              <Feather name="shopping-cart" size={48} color="#D1D5DB" className="mb-4" />
              <Text className="text-gray-500 font-semibold text-base mt-4">
                No orders found for this period.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default OrdersScreen;
