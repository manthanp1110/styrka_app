import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MapView, Marker, Polyline } from './NativeMap';

export interface MapplsTrackingMapProps {
  origin: { latitude: number; longitude: number };
  destination?: { latitude: number; longitude: number } | null;
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
    const mapRef = useRef<any>(null);
    const [currentCoord, setCurrentCoord] = React.useState<{ latitude: number; longitude: number } | null>(null);

    useImperativeHandle(ref, () => ({
      updateLocation: (coord: { latitude: number; longitude: number }) => {
        setCurrentCoord(coord);
        mapRef.current?.animateToRegion?.({
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 500);
      },
    }));

    const displayOrigin = currentCoord || origin;
    const hasValidDestination = !!(
      destination && 
      destination.latitude != null && 
      destination.longitude != null && 
      !isNaN(destination.latitude) && 
      !isNaN(destination.longitude) &&
      (destination.latitude !== 0 || destination.longitude !== 0)
    );

    const activePolyline = hasValidDestination
      ? (routeCoordinates.length > 0 ? routeCoordinates : [displayOrigin, destination!])
      : [];

    useEffect(() => {
      if (hasValidDestination && mapRef.current) {
        if (routeCoordinates.length > 1) {
          mapRef.current.fitToCoordinates(routeCoordinates);
        } else {
          mapRef.current.fitToCoordinates([displayOrigin, destination!]);
        }
      }
    }, [hasValidDestination, destination?.latitude, destination?.longitude, routeCoordinates.length]);

    return (
      <View style={[styles.container, style]}>
        <MapView
          ref={mapRef}
          style={styles.container}
          region={{
            latitude: displayOrigin.latitude,
            longitude: displayOrigin.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
        >
          <Marker coordinate={displayOrigin} title="My Current Location" pinColor="#2563EB" />
          {hasValidDestination && (
            <Marker coordinate={destination!} title="Destination" pinColor="#EF4444" />
          )}
          {activePolyline.length >= 2 && (
            <Polyline coordinates={activePolyline} strokeWidth={5} strokeColor="#2563EB" />
          )}
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
