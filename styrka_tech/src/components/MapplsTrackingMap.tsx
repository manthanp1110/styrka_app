import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform, UIManager } from 'react-native';
let MapplsTracking: any = null;
let isNativeWidgetAvailable = false;

try {
  if (Platform.OS !== 'web' && typeof UIManager.getViewManagerConfig === 'function') {
    const config = UIManager.getViewManagerConfig('MapplsTrackingWidget') || UIManager.getViewManagerConfig('RCTMGLMapView');
    if (config) {
      MapplsTracking = require('mappls-tracking-react-native');
      isNativeWidgetAvailable = !!MapplsTracking?.MapplsTrackingWidget;
    }
  }
} catch (e) {
  isNativeWidgetAvailable = false;
}

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

const layerStyle = {
  routePolylineStyle: {
    lineColor: '#3B82F6',
    lineWidth: 6,
    lineOpacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round',
  } as any,
  dashRoutePolylineStyle: {
    lineColor: '#9CA3AF',
    lineWidth: 4,
    lineOpacity: 0.75,
    lineCap: 'round',
    lineJoin: 'round',
    lineDasharray: [2, 4],
  } as any,
  destinationIconStyle: {
    iconAllowOverlap: true,
    iconAnchor: 'bottom',
    iconSize: 0.2,
  } as any,
  OriginIconStyle: {
    iconAllowOverlap: true,
    iconAnchor: 'bottom',
    iconSize: 0.2,
  } as any,
  destinationRouteConnectorStyle: {
    lineColor: '#787878',
    lineWidth: 4,
    lineOpacity: 0.75,
    lineCap: 'round',
    lineJoin: 'round',
    lineDasharray: [2, 4],
  } as any,
};

import { MapView, Marker, Polyline } from './NativeMap';

export const MapplsTrackingMap = forwardRef<MapplsTrackingMapRef, MapplsTrackingMapProps>(
  ({ origin, destination, routeCoordinates = [], style, onSegmentComplete, onTrackingEvent }, ref) => {
    const trackingWidgetRef = useRef<any>(null);
    const [hasError, setHasError] = React.useState(false);
    const [currentCoord, setCurrentCoord] = React.useState<{ latitude: number; longitude: number } | null>(null);

    useImperativeHandle(ref, () => ({
      updateLocation: (coord: { latitude: number; longitude: number }) => {
        setCurrentCoord(coord);
        if (trackingWidgetRef.current && typeof trackingWidgetRef.current.startTracking === 'function') {
          try {
            trackingWidgetRef.current.startTracking({
              currentLocation: [coord.longitude, coord.latitude],
            });
          } catch (e) {
            console.log('[MapplsTracking] Update error:', e);
          }
        }
      },
    }));

    const originPointStr = `${origin.longitude},${origin.latitude}`;
    const destinationPointStr = `${destination.longitude},${destination.latitude}`;

    const isWidgetAvailable = isNativeWidgetAvailable && !hasError;

    if (!isWidgetAvailable) {
      const activePolyline = routeCoordinates.length > 0 ? routeCoordinates : [origin, destination];
      return (
        <View style={[styles.container, style]}>
          <MapView
            style={styles.container}
            initialRegion={{
              latitude: origin.latitude,
              longitude: origin.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker coordinate={origin} title="Start" pinColor="green" />
            <Marker coordinate={destination} title="Destination" pinColor="red" />
            {currentCoord && (
              <Marker coordinate={currentCoord} title="Current Location" pinColor="blue" />
            )}
            <Polyline coordinates={activePolyline} strokeWidth={5} strokeColor="#3B82F6" />
          </MapView>
        </View>
      );
    }

    try {
      return (
        <View style={[styles.container, style]}>
          <MapplsTracking.MapplsTrackingWidget
            ref={trackingWidgetRef}
            orderId={`order-${origin.latitude}-${origin.longitude}`}
            originPoint={originPointStr}
            destinationPoint={destinationPointStr}
            speedInMillis={3000}
            resource="route_eta"
            profile="driving"
            routeChangeBuffer={50}
            latentViz="jump"
            polylineRefresh={false}
            cameraZoomLevel={14}
            routePolylineStyle={layerStyle.routePolylineStyle}
            dashRoutePolylineStyle={layerStyle.dashRoutePolylineStyle}
            destinationIconStyle={layerStyle.destinationIconStyle}
            OriginIconStyle={layerStyle.OriginIconStyle}
            destinationRouteConnectorStyle={layerStyle.destinationRouteConnectorStyle}
            enableDestinationRouteConnector={true}
            fitBoundsPadding={80}
            fitBoundsDuration={1000}
            latentVizRadius={100}
            trackingSegmentCompleteCallback={(event: any) => {
              if (onSegmentComplete) onSegmentComplete(event);
            }}
            trackingEventCallback={(eventName: string, eventValue: any) => {
              if (onTrackingEvent) onTrackingEvent(eventName, eventValue);
            }}
          />
        </View>
      );
    } catch (err) {
      console.warn('[MapplsTrackingMap] Render fallback due to native error:', err);
      setHasError(true);
      return null;
    }
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MapplsTrackingMap;
