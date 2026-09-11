import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Platform } from 'react-native';
import RNMapView, { 
  Marker as RNMarker, 
  Polyline as RNPolyline, 
  Callout as RNCallout, 
  UrlTile,
  PROVIDER_GOOGLE,
  Region,
  LatLng
} from 'react-native-maps';

export { PROVIDER_GOOGLE, UrlTile };

export const MapView = forwardRef<any, any>(({ style, children, provider, initialRegion, region, showsUserLocation = false, ...props }, ref) => {
  const innerRef = useRef<RNMapView>(null);
  const lastCoordinatesRef = useRef<LatLng[]>([]);

  useImperativeHandle(ref, () => ({
    animateToRegion: (targetRegion: Region, duration: number = 1000) => {
      innerRef.current?.animateToRegion(targetRegion, duration);
    },
    fitToCoordinates: (coordinates: LatLng[], options?: any) => {
      if (!coordinates || coordinates.length === 0) return;
      lastCoordinatesRef.current = coordinates;
      innerRef.current?.fitToCoordinates(coordinates, {
        edgePadding: options?.edgePadding || { top: 60, right: 60, bottom: 120, left: 60 },
        animated: options?.animated !== false,
      });
    },
    recenter: () => {
      if (lastCoordinatesRef.current.length > 0) {
        innerRef.current?.fitToCoordinates(lastCoordinatesRef.current, {
          edgePadding: { top: 60, right: 60, bottom: 120, left: 60 },
          animated: true,
        });
      }
    },
    // Direct access to underlying MapView methods
    getMapRef: () => innerRef.current,
  }));

  const activeRegion = region || initialRegion || {
    latitude: 18.5204,
    longitude: 73.8567,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const controlledProps: any = {
    initialRegion: activeRegion,
  };
  if (region) {
    controlledProps.region = region;
  }

  return (
    <RNMapView
      ref={innerRef}
      provider={provider !== undefined ? provider : (Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined)}
      style={[styles.map, style]}
      {...controlledProps}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={true}
      loadingEnabled={true}
      loadingIndicatorColor="#10B981"
      loadingBackgroundColor="#F3F4F6"
      toolbarEnabled={false}
      {...props}
    >
      {/* Primary Tile Layer: Google Maps raster tiles (renders 100% reliably even if Google Cloud key has API restriction) */}
      <UrlTile
        urlTemplate="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        maximumZ={20}
        flipY={false}
        zIndex={1}
      />
      {/* Fallback Tile Layer: OpenStreetMap global tiles underneath */}
      <UrlTile
        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
        zIndex={0}
      />
      {children}
    </RNMapView>
  );
});

export const Marker = ({ coordinate, pinColor, title, description, children, ...props }: any) => {
  if (!coordinate || coordinate.latitude == null || coordinate.longitude == null || isNaN(coordinate.latitude) || isNaN(coordinate.longitude)) {
    return null;
  }

  const validCoord = {
    latitude: Number(coordinate.latitude),
    longitude: Number(coordinate.longitude),
  };

  return (
    <RNMarker
      coordinate={validCoord}
      pinColor={pinColor}
      title={title}
      description={description}
      {...props}
    >
      {children}
    </RNMarker>
  );
};

export const Polyline = ({ coordinates, strokeColor = '#3B82F6', strokeWidth = 5, ...props }: any) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const validCoords = coordinates
    .filter((c: any) => c && c.latitude != null && c.longitude != null && !isNaN(c.latitude) && !isNaN(c.longitude))
    .map((c: any) => ({
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
    }));

  if (validCoords.length < 2) return null;

  return (
    <RNPolyline
      coordinates={validCoords}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
      lineCap="round"
      lineJoin="round"
      {...props}
    />
  );
};

export const Callout = RNCallout;

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default MapView;
