import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { LOCATION_TASK_NAME } from '../tasks/locationTask';

const EmployeeAttendanceScreen = () => {
  const { logout, user } = useAppState();
  const navigation = useNavigation();
  
  const [attendanceRecord, setAttendanceRecord] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [odometerPhoto, setOdometerPhoto] = useState<string | null>(null);
  const [odometerBase64, setOdometerBase64] = useState<string | null>(null);

  // Punch In Form State
  const [vehicleType, setVehicleType] = useState('');
  const [openingReading, setOpeningReading] = useState('');
  const [todaysPlan, setTodaysPlan] = useState('');
  const [farmerVisitTarget, setFarmerVisitTarget] = useState('');
  const [dealerVisitTarget, setDealerVisitTarget] = useState('');
  const [saleTarget, setSaleTarget] = useState('');
  const [collectionTarget, setCollectionTarget] = useState('');

  // Punch Out Form State
  const [closingReading, setClosingReading] = useState('');
  const [todaysSummary, setTodaysSummary] = useState('');
  const [actualFarmerVisit, setActualFarmerVisit] = useState('');
  const [actualDealerVisit, setActualDealerVisit] = useState('');
  const [actualSale, setActualSale] = useState('');
  const [actualCollection, setActualCollection] = useState('');

  const fetchTodayAttendance = async () => {
    setIsLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('daily_attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setAttendanceRecord(data);
      }
    } catch (e: any) {
      if (e.code !== 'PGRST116') { // not found is expected if they haven't punched in
        console.error(e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user.id) fetchTodayAttendance();
  }, [user.id]);

  const pickImage = () => {
    Alert.alert(
      "Odometer Photo",
      "Choose a photo source",
      [
        {
          text: "Camera",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) {
              alert("Camera permissions are required.");
              return;
            }
            launchPicker(true);
          }
        },
        {
          text: "Gallery (Recommended)",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
              alert("Gallery permissions are required.");
              return;
            }
            launchPicker(false);
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const launchPicker = async (isCamera: boolean) => {
    try {
      let result = isCamera 
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.5,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.5,
            base64: true,
          });
      
      if (!result.canceled) {
        setOdometerPhoto(result.assets[0].uri);
        setOdometerBase64(result.assets[0].base64 || null);
      }
    } catch (e) {
      alert("Failed to launch image picker. Try again.");
    }
  };

  const handlePunchIn = async () => {
    if (!vehicleType || !openingReading || !odometerPhoto) {
      alert("Please enter Vehicle Type, Opening Reading, and take an Odometer Photo.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 0. Upload Photo
      let photoUrl = null;
      try {
        const ext = odometerPhoto.substring(odometerPhoto.lastIndexOf('.') + 1) || 'jpg';
        const fileName = `${user.id}_${Date.now()}.${ext}`;
        
        if (!odometerBase64) throw new Error("Image data is missing.");
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('odometer-photos')
          .upload(fileName, decode(odometerBase64), { contentType: `image/${ext}` });
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('odometer-photos')
          .getPublicUrl(fileName);
          
        photoUrl = publicUrlData.publicUrl;
      } catch (uploadE: any) {
        throw new Error("Failed to upload odometer photo. Make sure the 'odometer-photos' bucket exists and is public. Details: " + uploadE.message);
      }

      // 1. Ask for background location permissions
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (fgStatus !== 'granted' || bgStatus !== 'granted') {
        alert("Background Location permission is required for shift tracking.");
        setIsSubmitting(false);
        return;
      }

      // 2. Get initial location
      const initialLocation = await Location.getCurrentPositionAsync({});

      // 3. Insert Attendance
      const { data: attendanceData, error } = await supabase.from('daily_attendance').insert([
        {
          user_id: user.id,
          vehicle_type: vehicleType,
          opening_reading: parseFloat(openingReading),
          odometer_photo_url: photoUrl,
          todays_plan: todaysPlan,
          farmer_visit_target: parseInt(farmerVisitTarget || '0', 10),
          dealer_visit_target: parseInt(dealerVisitTarget || '0', 10),
          sale_target: parseFloat(saleTarget || '0'),
          collection_target: parseFloat(collectionTarget || '0')
        }
      ]).select().single();

      if (error) throw error;

      alert("Punched In Successfully!");
      fetchTodayAttendance();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePunchOut = async () => {
    if (!closingReading) {
      alert("Please enter Closing Reading.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Stop background tracking
      const hasTask = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasTask) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // 2. End Journey in DB
      await supabase
        .from('journeys')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'active');

      // 3. Complete Attendance
      const { error } = await supabase
        .from('daily_attendance')
        .update({
          punch_out_time: new Date().toISOString(),
          closing_reading: parseFloat(closingReading),
          todays_summary: todaysSummary,
          actual_farmer_visit: parseInt(actualFarmerVisit || '0', 10),
          actual_dealer_visit: parseInt(actualDealerVisit || '0', 10),
          actual_sale: parseFloat(actualSale || '0'),
          actual_collection: parseFloat(actualCollection || '0'),
          total_distance_km: parseFloat(closingReading) - attendanceRecord.opening_reading
        })
        .eq('id', attendanceRecord.id);

      if (error) throw error;
      alert("Punched Out Successfully! Tracking stopped.");
      fetchTodayAttendance();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F7FB', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0F4C3A" />
      </SafeAreaView>
    );
  }

  const isPunchedIn = !!attendanceRecord;
  const isPunchedOut = isPunchedIn && !!attendanceRecord.punch_out_time;

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

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Main Card */}
        <View className="bg-white rounded-[24px] mx-4 mt-6 mb-10 shadow-sm shadow-gray-200 overflow-hidden">
          
          {/* Green Header Section inside card */}
          <View className={`px-5 py-6 relative ${isPunchedOut ? 'bg-gray-700' : isPunchedIn ? 'bg-red-600' : 'bg-[#145C44]'}`}>
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center">
                <TouchableOpacity onPress={() => navigation.goBack()} className={`w-10 h-10 rounded-xl items-center justify-center mr-4 border ${isPunchedOut ? 'bg-gray-600 border-gray-500' : isPunchedIn ? 'bg-red-700 border-red-800' : 'bg-[#1A7356] border-[#218F6B]'}`}>
                  <Feather name="arrow-left" size={20} color="white" />
                </TouchableOpacity>
                <View>
                  <Text className="text-[#F59E0B] text-xs font-bold tracking-wider mb-1 uppercase">ATTENDANCE</Text>
                  <Text className="text-white text-2xl font-bold">
                    {isPunchedOut ? "Day Completed" : isPunchedIn ? "Punch OUT Record" : "Punch IN Record"}
                  </Text>
                </View>
              </View>
              <Text className="text-emerald-100 font-medium text-xs mt-2">{new Date().toLocaleDateString()}</Text>
            </View>
          </View>

          {/* Form Content */}
          <View className="px-5 pt-6 pb-8">
            
            {isPunchedOut ? (
              <View className="items-center py-10">
                <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
                  <Feather name="check" size={40} color="#059669" />
                </View>
                <Text className="text-lg font-bold text-gray-800 mb-2">You're all set for today!</Text>
                <Text className="text-gray-500 text-center">You punched out at {new Date(attendanceRecord.punch_out_time).toLocaleTimeString()}</Text>
                <Text className="text-gray-500 text-center mt-2">Total Distance: {attendanceRecord.total_distance_km} km</Text>
              </View>
            ) : isPunchedIn ? (
              /* PUNCH OUT FORM */
              <>
                <View className="flex-row justify-between mb-6">
                  <View className="flex-1 pr-2">
                    <Text className="text-[#1F2937] font-bold text-sm mb-2">Opening Reading</Text>
                    <View className="border border-gray-200 rounded-xl px-3 py-3 bg-gray-50">
                      <Text className="text-gray-500 font-bold">{attendanceRecord.opening_reading}</Text>
                    </View>
                  </View>
                  <View className="flex-1 pl-2">
                    <Text className="text-[#1F2937] font-bold text-sm mb-2">Closing Odometer *</Text>
                    <TextInput 
                      className="border border-gray-300 rounded-xl px-3 py-3 bg-white text-[#374151] text-sm"
                      placeholder="Enter closing..."
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={closingReading}
                      onChangeText={setClosingReading}
                    />
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-[#1F2937] font-bold text-sm mb-2">Today's Summary</Text>
                  <TextInput 
                    className="border border-gray-300 rounded-xl px-4 py-3 bg-white text-[#374151] h-24 text-left text-sm"
                    placeholder="Briefly describe what you achieved today..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                    value={todaysSummary}
                    onChangeText={setTodaysSummary}
                  />
                </View>

                <View className="flex-row flex-wrap justify-between mb-8">
                  <View className="w-[23%]">
                    <Text className="text-[#1F2937] font-bold text-[11px] mb-2 leading-tight">Farmer{'\n'}Visits{'\n'}Actual</Text>
                    <TextInput className="border border-gray-300 rounded-xl px-2 py-2.5 bg-white text-[#374151] text-xs" placeholder="Count" keyboardType="numeric" value={actualFarmerVisit} onChangeText={setActualFarmerVisit} />
                  </View>
                  <View className="w-[23%]">
                    <Text className="text-[#1F2937] font-bold text-[11px] mb-2 leading-tight">Dealer{'\n'}Visits{'\n'}Actual</Text>
                    <TextInput className="border border-gray-300 rounded-xl px-2 py-2.5 bg-white text-[#374151] text-xs" placeholder="Count" keyboardType="numeric" value={actualDealerVisit} onChangeText={setActualDealerVisit} />
                  </View>
                  <View className="w-[23%]">
                    <Text className="text-[#1F2937] font-bold text-[11px] mb-2 leading-tight">Total{'\n'}Sale (₹){'\n'}</Text>
                    <TextInput className="border border-gray-300 rounded-xl px-2 py-2.5 bg-white text-[#374151] text-xs" placeholder="Amount" keyboardType="numeric" value={actualSale} onChangeText={setActualSale} />
                  </View>
                  <View className="w-[23%]">
                    <Text className="text-[#1F2937] font-bold text-[11px] mb-2 leading-tight">Total{'\n'}Collect (₹){'\n'}</Text>
                    <TextInput className="border border-gray-300 rounded-xl px-2 py-2.5 bg-white text-[#374151] text-xs" placeholder="Amount" keyboardType="numeric" value={actualCollection} onChangeText={setActualCollection} />
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={handlePunchOut}
                  disabled={isSubmitting}
                  className={`bg-red-600 rounded-2xl py-4 flex-row justify-center items-center shadow-md shadow-red-200 ${isSubmitting ? 'opacity-70' : ''}`}
                >
                  {isSubmitting && <ActivityIndicator color="white" size="small" className="mr-2" />}
                  <Text className="text-white font-bold text-lg tracking-wide">{isSubmitting ? 'SUBMITTING...' : 'PUNCH OUT RECORD'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* PUNCH IN FORM */
              <>
                <View className="flex-row justify-between mb-6">
                  <View className="flex-1 pr-2">
                    <Text className="text-[#1F2937] font-bold text-sm mb-2">Vehicle Type *</Text>
                    <TextInput 
                      className="border border-gray-300 rounded-xl px-3 py-3 bg-white text-[#374151] text-sm"
                      placeholder="e.g. 2-Wheeler"
                      placeholderTextColor="#9CA3AF"
                      value={vehicleType}
                      onChangeText={setVehicleType}
                    />
                  </View>
                  <View className="flex-1 pl-2">
                    <Text className="text-[#1F2937] font-bold text-sm mb-2">Opening Odometer *</Text>
                    <TextInput 
                      className="border border-gray-300 rounded-xl px-3 py-3 bg-white text-[#374151] text-sm"
                      placeholder="Enter reading..."
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={openingReading}
                      onChangeText={setOpeningReading}
                    />
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-[#1F2937] font-bold text-sm mb-2">Odometer Photo *</Text>
                  <TouchableOpacity 
                    onPress={pickImage}
                    className="border border-dashed border-gray-400 rounded-xl h-32 bg-gray-50 items-center justify-center overflow-hidden"
                  >
                    {odometerPhoto ? (
                      <View className="w-full h-full">
                        <Image source={{ uri: odometerPhoto }} style={{ width: '100%', height: '100%' }} />
                        <View className="absolute bottom-2 right-2 bg-black/50 px-2 py-1 rounded-md">
                          <Text className="text-white text-xs font-bold">Retake</Text>
                        </View>
                      </View>
                    ) : (
                      <View className="items-center">
                        <Feather name="camera" size={24} color="#6B7280" />
                        <Text className="text-gray-500 mt-2 font-medium">Tap to capture Odometer</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <View className="mb-6">
                  <Text className="text-[#1F2937] font-bold text-sm mb-2">Today's Plan</Text>
                  <TextInput 
                    className="border border-gray-300 rounded-xl px-4 py-3 bg-white text-[#374151] h-24 text-left text-sm"
                    placeholder="Briefly describe your plan for today..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                    value={todaysPlan}
                    onChangeText={setTodaysPlan}
                  />
                </View>

                <View className="flex-row flex-wrap justify-between mb-8">
                  <View className="w-[23%]">
                    <Text className="text-[#1F2937] font-bold text-[11px] mb-2 leading-tight">Farmer{'\n'}Visit{'\n'}Target</Text>
                    <TextInput className="border border-gray-300 rounded-xl px-2 py-2.5 bg-white text-[#374151] text-xs" placeholder="Count" keyboardType="numeric" value={farmerVisitTarget} onChangeText={setFarmerVisitTarget} />
                  </View>
                  <View className="w-[23%]">
                    <Text className="text-[#1F2937] font-bold text-[11px] mb-2 leading-tight">Dealer{'\n'}Visit{'\n'}Target</Text>
                    <TextInput className="border border-gray-300 rounded-xl px-2 py-2.5 bg-white text-[#374151] text-xs" placeholder="Count" keyboardType="numeric" value={dealerVisitTarget} onChangeText={setDealerVisitTarget} />
                  </View>
                  <View className="w-[23%]">
                    <Text className="text-[#1F2937] font-bold text-[11px] mb-2 leading-tight">Sale{'\n'}Target (₹){'\n'}</Text>
                    <TextInput className="border border-gray-300 rounded-xl px-2 py-2.5 bg-white text-[#374151] text-xs" placeholder="Amount" keyboardType="numeric" value={saleTarget} onChangeText={setSaleTarget} />
                  </View>
                  <View className="w-[23%]">
                    <Text className="text-[#1F2937] font-bold text-[11px] mb-2 leading-tight">Collection{'\n'}Target (₹){'\n'}</Text>
                    <TextInput className="border border-gray-300 rounded-xl px-2 py-2.5 bg-white text-[#374151] text-xs" placeholder="Amount" keyboardType="numeric" value={collectionTarget} onChangeText={setCollectionTarget} />
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={handlePunchIn}
                  disabled={isSubmitting}
                  className={`bg-[#059669] rounded-2xl py-4 flex-row justify-center items-center shadow-md shadow-green-200 ${isSubmitting ? 'opacity-70' : ''}`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" size="small" className="mr-2" />
                  ) : (
                    <View className="w-4 h-4 rounded-full bg-[#34D399] mr-2.5 border-2 border-white/30 shadow-sm" />
                  )}
                  <Text className="text-white font-bold text-lg tracking-wide">{isSubmitting ? 'SUBMITTING...' : 'PUNCH IN RECORD'}</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EmployeeAttendanceScreen;
