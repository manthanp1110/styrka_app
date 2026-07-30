import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import MapplsTracking from 'mappls-tracking-react-native';

export interface MapplsTrackingMapProps {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
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
};

export const MapplsTrackingMap = forwardRef<MapplsTrackingMapRef, MapplsTrackingMapProps>(
  ({ origin, destination, style, onSegmentComplete, onTrackingEvent }, ref) => {
    const trackingWidgetRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      updateLocation: (coord: { latitude: number; longitude: number }) => {
        if (trackingWidgetRef.current) {
          trackingWidgetRef.current.startTracking({
            currentLocation: [coord.longitude, coord.latitude],
          });
        }
      },
    }));

    const originPointStr = `${origin.longitude},${origin.latitude}`;
    const destinationPointStr = `${destination.longitude},${destination.latitude}`;

    return (
      <View style={[styles.container, style]}>
        <MapplsTracking.MapplsTrackingWidget
          ref={trackingWidgetRef}
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
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MapplsTrackingMap;
