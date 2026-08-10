import React, { forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MapView, Marker, Polyline } from './NativeMap';

export interface MapplsTrackingMapProps {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  routeCoordinates?: any[];
  style?: StyleProp<ViewStyle>;
  onSegmentComplete?: (event: any) => void;
  onTrackingEvent?: (eventName: string, eventValue: any) => void;
}

export interface MapplsTrackingMapRef {
  updateLocation: (coord: { latitude: number; longitude: number }) => void;
}

export const MapplsTrackingMap = forwardRef<MapplsTrackingMapRef, MapplsTrackingMapProps>(
  ({ origin, destination, routeCoordinates = [], style }, ref) => {
    const [currentCoord, setCurrentCoord] = React.useState<{ latitude: number; longitude: number } | null>(null);

    useImperativeHandle(ref, () => ({
      updateLocation: (coord: { latitude: number; longitude: number }) => {
        setCurrentCoord(coord);
      },
    }));

    const displayOrigin = currentCoord || origin;
    const activePolyline = routeCoordinates.length > 0 ? routeCoordinates : [displayOrigin, destination];

    return (
      <View style={[styles.container, style]}>
        <MapView
          style={styles.container}
          region={{
            latitude: displayOrigin.latitude,
            longitude: displayOrigin.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <Marker coordinate={displayOrigin} title="My Current Location" pinColor="green" />
          <Marker coordinate={destination} title="Destination" pinColor="red" />
          <Polyline coordinates={activePolyline} strokeWidth={5} strokeColor="#3B82F6" />
        </MapView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MapplsTrackingMap;
