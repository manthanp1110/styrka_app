/**
 * MapLibre compatibility wrapper for react-native-maps
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  Map,
  Camera,
  Marker as MapLibreMarker,
  Callout as MapLibreCallout,
  GeoJSONSource,
  Layer,
} from '@maplibre/maplibre-react-native';

// Mathematically correct Mercator Zoom-from-Delta calculation
function getZoomFromRegion(region: any): number {
  const { width, height } = Dimensions.get('window');
  const minZoom = 0;
  const maxZoom = 22;

  if (!region || !region.longitudeDelta || !region.latitudeDelta) return 15; // default fallback

  // Width zoom calculation
  const zoomLng = Math.log2((360 * width) / (256 * region.longitudeDelta));
  
  // Height zoom calculation adjusting for Mercator stretch
  const radLat = (region.latitude * Math.PI) / 180;
  const zoomLat = Math.log2((180 * height * Math.cos(radLat)) / (256 * region.latitudeDelta));

  const zoom = Math.min(zoomLng, zoomLat);
  return Math.min(Math.max(zoom, minZoom), maxZoom);
}

// MapTiler Vector tile style setup using environment variable
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY;
const MAP_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://demotiles.maplibre.org/style.json';


export const MapView = forwardRef(({ initialRegion, region, style, onPress, onLongPress, children, ...props }: any, ref) => {
  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (targetRegion: any, duration = 1000) => {
      cameraRef.current?.setCamera({
        center: [targetRegion.longitude, targetRegion.latitude],
        zoom: getZoomFromRegion(targetRegion),
        duration: duration,
      });
    },
    fitToCoordinates: (coordinates: any[], options: any = {}) => {
      if (coordinates.length === 0) return;
      
      let minLat = 90;
      let maxLat = -90;
      let minLng = 180;
      let maxLng = -180;

      coordinates.forEach(c => {
        if (c.latitude < minLat) minLat = c.latitude;
        if (c.latitude > maxLat) maxLat = c.latitude;
        if (c.longitude < minLng) minLng = c.longitude;
        if (c.longitude > maxLng) maxLng = c.longitude;
      });

      const ne = [maxLng, maxLat];
      const sw = [minLng, minLat];
      
      const padding = options.edgePadding || { top: 40, right: 40, bottom: 40, left: 40 };

      cameraRef.current?.fitBounds(
        ne,
        sw,
        [padding.top, padding.right, padding.bottom, padding.left],
        options.duration || 1000
      );
    }
  }));

  const activeRegion = region || initialRegion;
  const centerCoordinate = activeRegion ? [activeRegion.longitude, activeRegion.latitude] : [73.8567, 18.5204];
  const zoomLevel = activeRegion ? getZoomFromRegion(activeRegion) : 12;

  const handlePress = (e: any) => {
    if (onPress) {
      const geometry = e.geometry || e.nativeEvent?.geometry;
      if (geometry && geometry.coordinates) {
        onPress({
          nativeEvent: {
            coordinate: {
              latitude: geometry.coordinates[1],
              longitude: geometry.coordinates[0],
            }
          }
        });
      }
    }
  };

  const handleLongPress = (e: any) => {
    if (onLongPress) {
      const geometry = e.geometry || e.nativeEvent?.geometry;
      if (geometry && geometry.coordinates) {
        onLongPress({
          nativeEvent: {
            coordinate: {
              latitude: geometry.coordinates[1],
              longitude: geometry.coordinates[0],
            }
          }
        });
      }
    }
  };

  return (
    <Map
      ref={mapRef}
      style={style || styles.map}
      mapStyle={MAP_STYLE_URL}
      onPress={handlePress}
      onLongPress={handleLongPress}
      attribution={false}
      logo={false}
    >
      <Camera
        ref={cameraRef}
        center={centerCoordinate as [number, number]}
        zoom={zoomLevel}
      />
      {children}
    </Map>
  );
});

export const Marker = ({ coordinate, onPress, children, ...props }: any) => {
  if (!coordinate) return null;
  return (
    <MapLibreMarker
      lngLat={[coordinate.longitude, coordinate.latitude]}
      onPress={onPress}
      {...props}
    >
      {/* MapLibre Marker expects a single wrapper view child */}
      <View>{children}</View>
    </MapLibreMarker>
  );
};

export const Polyline = ({ coordinates, strokeColor = '#10B981', strokeWidth = 4 }: any) => {
  if (!coordinates || coordinates.length < 2) return null;

  const geojson: any = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map((c: any) => [c.longitude, c.latitude]),
    },
  };

  const sourceId = `polyline-source-${coordinates[0].latitude}-${coordinates[0].longitude}`;
  const layerId = `polyline-layer-${coordinates[0].latitude}-${coordinates[0].longitude}`;

  return (
    <GeoJSONSource id={sourceId} data={geojson}>
      <Layer
        id={layerId}
        type="line"
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </GeoJSONSource>
  );
};

export const Callout = ({ children, ...props }: any) => {
  return (
    <MapLibreCallout {...props}>
      {children}
    </MapLibreCallout>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
