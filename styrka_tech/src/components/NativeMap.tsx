import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

export const PROVIDER_GOOGLE = 'google';

// Mathematically accurate Web Mercator Zoom-from-Delta calculation
function getZoomFromRegion(region: any): number {
  const { width, height } = Dimensions.get('window');
  const minZoom = 3;
  const maxZoom = 20;

  if (!region || !region.longitudeDelta || !region.latitudeDelta) return 15;

  const zoomLng = Math.log2((360 * width) / (256 * region.longitudeDelta));
  const radLat = (region.latitude * Math.PI) / 180;
  const zoomLat = Math.log2((180 * height * Math.cos(radLat)) / (256 * region.latitudeDelta));

  const zoom = Math.min(zoomLng, zoomLat);
  return Math.min(Math.max(zoom, minZoom), maxZoom);
}

// ──────────────────────────────────────────────
// Universal High-Reliability Map Engine (Google Tiles + Leaflet)
// ──────────────────────────────────────────────
export const MapView = forwardRef<any, any>(({ initialRegion, region, style, children, onRegionChangeComplete, onPanDrag }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const activeRegion = region || initialRegion || { latitude: 18.5204, longitude: 73.8567 };

  useImperativeHandle(ref, () => ({
    animateToRegion: (targetRegion: any, duration?: number) => {
      if (!targetRegion || targetRegion.latitude == null || targetRegion.longitude == null) return;
      const zoom = getZoomFromRegion(targetRegion);
      const js = `if (window.map) { window.map.setView([${Number(targetRegion.latitude)}, ${Number(targetRegion.longitude)}], ${Math.round(zoom)}, { animate: true, duration: ${duration ? duration / 1000 : 0.6} }); } true;`;
      webViewRef.current?.injectJavaScript(js);
    },
    fitToCoordinates: (coordinates: any[], options?: any) => {
      if (!coordinates || coordinates.length === 0) return;
      const valid = coordinates
        .filter((c: any) => c && c.latitude != null && c.longitude != null)
        .map((c: any) => `[${Number(c.latitude)}, ${Number(c.longitude)}]`)
        .join(',');
      if (!valid) return;
      const pad = options?.edgePadding?.top || 50;
      const js = `if (window.map) { window.map.fitBounds([${valid}], { padding: [${pad}, ${pad}] }); } true;`;
      webViewRef.current?.injectJavaScript(js);
    },
    recenter: () => {
      const js = `if (window.recenterMap) { window.recenterMap(); } true;`;
      webViewRef.current?.injectJavaScript(js);
    },
    getMapRef: () => webViewRef.current,
  }));

  // Recursively extract markers and polylines from React children
  const markersData: any[] = [];
  const polylinesData: any[] = [];

  const processChild = (child: any) => {
    if (!child || !React.isValidElement(child)) return;
    let props: any = child.props || {};

    if (child.type === React.Fragment && props.children) {
      React.Children.toArray(props.children).forEach(processChild);
      return;
    }

    if (!props.coordinate && props.latestLocation && props.latestLocation.latitude != null) {
      props = {
        coordinate: {
          latitude: Number(props.latestLocation.latitude),
          longitude: Number(props.latestLocation.longitude),
        },
        pinColor: '#3B82F6',
        title: props.selectedEmp?.name || props.selectedEmp?.first_name || 'Rider',
      };
    }

    // Process Marker
    if (props.coordinate) {
      const lat = Number(props.coordinate.latitude ?? props.coordinate.lat);
      const lng = Number(props.coordinate.longitude ?? props.coordinate.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const pinColor = props.pinColor || '#3B82F6';
        const isDest = pinColor === 'red' || pinColor === '#EF4444' || props.title === 'Destination';
        markersData.push({
          lat,
          lng,
          title: props.title || (isDest ? 'Destination' : 'Rider'),
          color: pinColor,
          isRider: !isDest && (pinColor === '#3B82F6' || pinColor === '#2563EB' || !!props.latestLocation),
        });
      }
    }

    // Process Polyline
    if (props.coordinates && Array.isArray(props.coordinates) && props.coordinates.length >= 2) {
      const validCoords = props.coordinates
        .map((c: any) => {
          if (!c) return null;
          const lat = Number(c.latitude ?? c.lat ?? (Array.isArray(c) ? c[0] : null));
          const lng = Number(c.longitude ?? c.lng ?? (Array.isArray(c) ? c[1] : null));
          if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
            return [lat, lng];
          }
          return null;
        })
        .filter(Boolean);

      if (validCoords.length >= 2) {
        polylinesData.push({
          coords: validCoords,
          color: props.strokeColor || '#3B82F6',
          weight: props.strokeWidth || 5,
        });
      }
    }

    // Also process nested children
    if (props.children && child.type !== Marker && child.type !== Polyline) {
      React.Children.toArray(props.children).forEach(processChild);
    }
  };

  React.Children.toArray(children).forEach(processChild);

  const markersJson = JSON.stringify(markersData);
  const polylinesJson = JSON.stringify(polylinesData);

  React.useEffect(() => {
    if (webViewRef.current) {
      const js = `if (window.renderData) { window.renderData(${markersJson}, ${polylinesJson}); } true;`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [markersJson, polylinesJson]);

  const initialZoom = Math.max(8, Math.min(18, Math.round(getZoomFromRegion(activeRegion))));

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #e5e7eb; overflow: hidden; }
    .custom-map-icon {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .rider-name-tag {
      position: absolute;
      top: -26px;
      background: #0F4C3A;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 3px 8px;
      border-radius: 10px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      border: 1.5px solid rgba(255,255,255,0.8);
      z-index: 1000;
    }
    .rider-pulse {
      width: 40px;
      height: 40px;
      background: rgba(37, 99, 235, 0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 1.6s infinite;
    }
    .navigation-arrow-symbol {
      width: 26px;
      height: 26px;
      background: #2563EB;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    @keyframes pulse {
      0% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.6); }
      70% { transform: scale(1.35); box-shadow: 0 0 0 12px rgba(37, 99, 235, 0); }
      100% { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
    }
    .start-pin {
      width: 18px; height: 18px; background: #10B981; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
    .dest-pin {
      width: 22px; height: 22px; background: #EF4444; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.45);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    window.map = L.map('map', { 
      zoomControl: false,
      minZoom: 3,
      maxZoom: 20
    }).setView([${Number(activeRegion.latitude) || 18.5204}, ${Number(activeRegion.longitude) || 73.8567}], ${initialZoom});
    
    // Primary Layer: Google Maps Road Tiles
    var primaryTile = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      minZoom: 3,
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    });

    primaryTile.on('tileerror', function() {
      // Fallback: OpenStreetMap
      var osmTile = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        minZoom: 3,
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      });
      osmTile.addTo(window.map);
    });

    primaryTile.addTo(window.map);

    var dataGroup = L.layerGroup().addTo(window.map);
    var isFirstRender = true;
    var lastCombinedBounds = null;

    window.recenterMap = function() {
      if (lastCombinedBounds) {
        window.map.fitBounds(lastCombinedBounds, { padding: [40, 40] });
      }
    };

    window.renderData = function(markersData, polylinesData) {
      dataGroup.clearLayers();

      var riderPos = null;

      // Render Markers
      markersData.forEach(function(m) {
        var iconHtml;
        var titleText = m.title || 'Rider';
        if (m.isRider) {
          riderPos = [m.lat, m.lng];
          iconHtml = '<div class=\"rider-name-tag\">' + titleText + '</div><div class=\"rider-pulse\"><div class=\"navigation-arrow-symbol\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"#FFFFFF\"><path d=\"M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z\"/></svg></div></div>';
        } else if (m.color === '#10B981' || m.color === 'green') {
          iconHtml = '<div class=\"start-pin\"></div>';
        } else {
          iconHtml = '<div class=\"dest-pin\"></div>';
        }

        var customIcon = L.divIcon({
          className: 'custom-map-icon',
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        var marker = L.marker([m.lat, m.lng], { icon: customIcon }).addTo(dataGroup);
        if (m.title) {
          marker.bindPopup(m.title);
        }
      });

      // Render Polylines
      var allBounds = [];
      polylinesData.forEach(function(p) {
        if (p.coords && p.coords.length >= 2) {
          var poly = L.polyline(p.coords, { color: p.color, weight: p.weight, opacity: 0.88, lineCap: 'round', lineJoin: 'round' }).addTo(dataGroup);
          allBounds.push(poly.getBounds());
        }
      });

      if (allBounds.length > 0) {
        var combinedBounds = allBounds[0];
        for (var i = 1; i < allBounds.length; i++) {
          combinedBounds.extend(allBounds[i]);
        }
        lastCombinedBounds = combinedBounds;
        if (isFirstRender) {
          isFirstRender = false;
          window.map.fitBounds(combinedBounds, { padding: [50, 50] });
        }
      } else if (riderPos && isFirstRender) {
        isFirstRender = false;
        window.map.setView(riderPos, 16);
      }
    };

    window.renderData(${markersJson}, ${polylinesJson});
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://localhost' }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        androidLayerType="hardware"
      />
    </View>
  );
});

export const Marker = ({ coordinate, pinColor, title, description, children, ...props }: any) => {
  return null;
};

export const Polyline = ({ coordinates, strokeColor = '#3B82F6', strokeWidth = 5, ...props }: any) => {
  return null;
};

export const Callout = ({ children, ...props }: any) => {
  return null;
};

export const UrlTile = ({ urlTemplate, ...props }: any) => {
  return null;
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    flex: 1,
  },
});

export default MapView;
