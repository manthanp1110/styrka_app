import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MapView = ({ children, style }: any) => (
  <View style={[style, styles.container]}>
    <View style={styles.card}>
      <Text style={styles.text}>Native Maps Disabled on Web</Text>
      <Text style={styles.subtext}>Open the app in Expo Go on your mobile device to view and interact with the real GPS map.</Text>
    </View>
  </View>
);
export const Marker = ({ children }: any) => <>{children}</>;
export const Polyline = () => null;
export const Callout = ({ children }: any) => <>{children}</>;

const styles = StyleSheet.create({
  container: { 
    backgroundColor: '#E5E7EB', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 20
  },
  card: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  text: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  subtext: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 }
});
