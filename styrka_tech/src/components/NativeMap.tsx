import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, UIManager, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

let MapplsGL: any = null;
let isNativeMapplsAvailable = false;

const MAPPLS_KEY = process.env.EXPO_PUBLIC_MAPPLS_API_KEY || '28b2df366fa28c4d538d96c1b5cf32fb';

// Strictly set isNativeMapplsAvailable to false in JS bundle unless native Mappls native views exist
try {
  if (Platform.OS !== 'web' && typeof UIManager.getViewManagerConfig === 'function') {
    const mapViewConfig = UIManager.getViewManagerConfig('RCTMGLMapView');
    const cameraConfig = UIManager.getViewManagerConfig('RCTMGLCamera');
    // Verify view manager configs are valid objects with native commands
    if (mapViewConfig && cameraConfig) {
      MapplsGL = require('mappls-map-react-native').default;
      isNativeMapplsAvailable = true;
    }
  }
} catch (e) {
  isNativeMapplsAvailable = false;
}

// Mathematically correct Mercator Zoom-from-Delta calculation
function getZoomFromRegion(region: any): number {
  const { width, height } = Dimensions.get('window');
  const minZoom = 0;
  const maxZoom = 22;

  if (!region || !region.longitudeDelta || !region.latitudeDelta) return 14;

  const zoomLng = Math.log2((360 * width) / (256 * region.longitudeDelta));
  const radLat = (region.latitude * Math.PI) / 180;
  const zoomLat = Math.log2((180 * height * Math.cos(radLat)) / (256 * region.latitudeDelta));

  const zoom = Math.min(zoomLng, zoomLat);
  return Math.min(Math.max(zoom, minZoom), maxZoom);
}

// ──────────────────────────────────────────────
// Expo Go Interactive WebView Map (Leaflet / OpenStreetMap)
// ──────────────────────────────────────────────
const ExpoGoWebViewMap = forwardRef(({ initialRegion, region, style, children }: any, ref) => {
  const webViewRef = useRef<WebView>(null);
  const activeRegion = region || initialRegion || { latitude: 18.5204, longitude: 73.8567 };

  useImperativeHandle(ref, () => ({
    animateToRegion: (targetRegion: any) => {
      const zoom = getZoomFromRegion(targetRegion);
      const js = `map.setView([${targetRegion.latitude}, ${targetRegion.longitude}], ${Math.round(zoom)});`;
      webViewRef.current?.injectJavaScript(js);
    },
    fitToCoordinates: (coordinates: any[]) => {
      if (!coordinates || coordinates.length === 0) return;
      const bounds = coordinates.map(c => `[${c.latitude}, ${c.longitude}]`).join(',');
      const js = `map.fitBounds([${bounds}], { padding: [40, 40] });`;
      webViewRef.current?.injectJavaScript(js);
    }
  }));

  // Parse markers and polylines from React children
  const markersData: any[] = [];
  const polylinesData: any[] = [];

  React.Children.forEach(children, (child) => {
    if (!child || !React.isValidElement(child)) return;
    const props: any = child.props || {};

    // Marker
    if (props.coordinate && props.coordinate.latitude != null) {
      markersData.push({
        lat: props.coordinate.latitude,
        lng: props.coordinate.longitude,
        title: props.title || '',
        color: props.pinColor || '#EF4444'
      });
    }

    // Polyline
    if (props.coordinates && Array.isArray(props.coordinates) && props.coordinates.length >= 2) {
      polylinesData.push({
        coords: props.coordinates.map((c: any) => [c.latitude, c.longitude]),
        color: props.strokeColor || '#3B82F6',
        weight: props.strokeWidth || 5
      });
    }
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #e5e7eb; }
    .rider-pulse {
      width: 24px;
      height: 24px;
      background: rgba(37, 99, 235, 0.35);
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
      animation: pulse 1.6s infinite;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rider-dot {
      width: 14px;
      height: 14px;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7); }
      70% { transform: scale(1.3); box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
    }
    .start-pin {
      width: 16px; height: 16px; background: #10B981; border: 3px solid #FFF; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .dest-pin {
      width: 16px; height: 16px; background: #EF4444; border: 3px solid #FFF; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${activeRegion.latitude}, ${activeRegion.longitude}], ${Math.round(getZoomFromRegion(activeRegion))});
    
    var mapplsTileLayer = L.tileLayer('https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/tile/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; Mappls (MapmyIndia)'
    });

    mapplsTileLayer.on('tileerror', function() {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
    });

    mapplsTileLayer.addTo(map);

    var markersData = ${JSON.stringify(markersData)};
    var polylinesData = ${JSON.stringify(polylinesData)};

    // Render Markers
    markersData.forEach(function(m) {
      var iconHtml;
      if (m.color === '#3B82F6' || m.color === '#2563EB' || m.title.includes('Rider') || m.title.includes('Your Location')) {
        iconHtml = '<div class="rider-pulse"><div class="rider-dot"></div></div>';
      } else if (m.color === '#10B981' || m.title.includes('Start')) {
        iconHtml = '<div class="start-pin"></div>';
      } else {
        iconHtml = '<div class="dest-pin"></div>';
      }

      var customIcon = L.divIcon({
        className: 'custom-map-icon',
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);
    });

    // Render Polylines
    polylinesData.forEach(function(p) {
      if (p.coords && p.coords.length >= 2) {
        L.polyline(p.coords, { color: p.color, weight: p.weight, opacity: 0.85, lineCap: 'round' }).addTo(map);
      }
    });

    if (polylinesData.length > 0 && polylinesData[0].coords.length >= 2) {
      var bounds = L.latLngBounds(polylinesData[0].coords);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.map, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ flex: 1 }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
});

// ──────────────────────────────────────────────
// Native Mappls MapView
// ──────────────────────────────────────────────
const NativeMapView = forwardRef(({ initialRegion, region, style, onPress, onLongPress, children, ...props }: any, ref) => {
  const cameraRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (targetRegion: any, duration = 1000) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [targetRegion.longitude, targetRegion.latitude],
        zoomLevel: getZoomFromRegion(targetRegion),
        animationDuration: duration,
      });
    },
    fitToCoordinates: (coordinates: any[], options: any = {}) => {
      if (coordinates.length === 0) return;
      
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
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
        ne, sw,
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

  return (
    <MapplsGL.MapView
      ref={mapRef}
      style={style || styles.map}
      onPress={handlePress}
      attributionEnabled={false}
      logoEnabled={false}
    >
      <MapplsGL.Camera
        ref={cameraRef}
        centerCoordinate={centerCoordinate as [number, number]}
        zoomLevel={zoomLevel}
      />
      {children}
    </MapplsGL.MapView>
  );
});

// Error Boundary Wrapper for MapView to catch native view config errors
class MapErrorBoundary extends React.Component<any, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.log('[NativeMap] Native map renderer exception, fallback to WebView:', error);
  }

  render() {
    if (this.state.hasError) {
      return <ExpoGoWebViewMap {...this.props} />;
    }
    return this.props.children;
  }
}

// ──────────────────────────────────────────────
// Exported MapView — auto-selects native or WebView map with error boundary
// ──────────────────────────────────────────────
export const MapView = forwardRef((props: any, ref: any) => {
  if (isNativeMapplsAvailable && MapplsGL) {
    return (
      <MapErrorBoundary {...props}>
        <NativeMapView ref={ref} {...props} />
      </MapErrorBoundary>
    );
  }
  return <ExpoGoWebViewMap ref={ref} {...props} />;
});

// ──────────────────────────────────────────────
// Marker
// ──────────────────────────────────────────────
export const Marker = ({ coordinate, onPress, children, pinColor, id, title, ...props }: any) => {
  if (!coordinate) return null;

  if (!isNativeMapplsAvailable || !MapplsGL) {
    return children || null;
  }

  const markerId = id || `marker-${coordinate.latitude}-${coordinate.longitude}`;
  
  return (
    <MapplsGL.PointAnnotation
      id={markerId}
      coordinate={[coordinate.longitude, coordinate.latitude]}
      onSelected={onPress}
      {...props}
    >
      {children ? (
        <View>{children}</View>
      ) : (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ 
            width: 16, height: 16, borderRadius: 8, 
            backgroundColor: pinColor || '#EF4444', 
            borderWidth: 2, borderColor: 'white',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3, shadowRadius: 3, elevation: 4
          }} />
        </View>
      )}
    </MapplsGL.PointAnnotation>
  );
};

// ──────────────────────────────────────────────
// Polyline
// ──────────────────────────────────────────────
export const Polyline = ({ coordinates, strokeColor = '#3B82F6', strokeWidth = 4 }: any) => {
  if (!coordinates || coordinates.length < 2) return null;

  if (!isNativeMapplsAvailable || !MapplsGL) {
    return null;
  }

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
    <MapplsGL.ShapeSource id={sourceId} shape={geojson}>
      <MapplsGL.LineLayer
        id={layerId}
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </MapplsGL.ShapeSource>
  );
};

// ──────────────────────────────────────────────
// Callout
// ──────────────────────────────────────────────
export const Callout = ({ children, ...props }: any) => {
  if (!isNativeMapplsAvailable || !MapplsGL) return children || null;
  return (
    <MapplsGL.Callout {...props}>
      {children}
    </MapplsGL.Callout>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
