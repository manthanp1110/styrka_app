import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const MAPPLS_KEY = process.env.EXPO_PUBLIC_MAPPLS_API_KEY || '28b2df366fa28c4d538d96c1b5cf32fb';

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
// Universal WebView Map Engine (Leaflet + Mappls Tiles)
// ──────────────────────────────────────────────
const UniversalWebViewMap = forwardRef(({ initialRegion, region, style, children }: any, ref) => {
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

  // Parse markers and polylines recursively from React children
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
          longitude: Number(props.latestLocation.longitude)
        },
        pinColor: '#3B82F6',
        title: props.selectedEmp?.name || props.selectedEmp?.first_name || 'Rider'
      };
    }

    // Marker
    if (props.coordinate) {
      const lat = Number(props.coordinate.latitude ?? props.coordinate.lat);
      const lng = Number(props.coordinate.longitude ?? props.coordinate.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        const pinColor = props.pinColor || '#3B82F6';
        const isDest = pinColor === 'red' || pinColor === '#EF4444' || props.title === 'Destination';
        markersData.push({
          lat,
          lng,
          title: props.title || (isDest ? 'Destination' : 'Rider'),
          color: pinColor,
          isRider: !isDest && (pinColor === '#3B82F6' || pinColor === '#2563EB' || !!props.latestLocation)
        });
      }
    }

    // Polyline
    if (props.coordinates && Array.isArray(props.coordinates) && props.coordinates.length >= 2) {
      const validCoords = props.coordinates
        .map((c: any) => {
          if (!c) return null;
          const lat = Number(c.latitude ?? c.lat ?? (Array.isArray(c) ? c[0] : null));
          const lng = Number(c.longitude ?? c.lng ?? (Array.isArray(c) ? c[1] : null));
          if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
            return [lat, lng];
          }
          return null;
        })
        .filter(Boolean);

      if (validCoords.length >= 2) {
        polylinesData.push({
          coords: validCoords,
          color: props.strokeColor || '#3B82F6',
          weight: props.strokeWidth || 5
        });
      }
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

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #e5e7eb; }
    .custom-map-icon {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .rider-name-tag {
      position: absolute;
      top: -24px;
      background: #0F4C3A;
      color: white;
      font-weight: bold;
      font-size: 10px;
      font-family: sans-serif;
      padding: 2px 7px;
      border-radius: 8px;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      z-index: 1000;
    }
    .rider-pulse {
      width: 36px;
      height: 36px;
      background: rgba(37, 99, 235, 0.35);
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
      animation: pulse 1.6s infinite;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .navigation-arrow-symbol {
      width: 24px;
      height: 24px;
      background: #2563EB;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
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
      width: 18px; height: 18px; background: #EF4444; border: 3px solid #FFF; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Strict Maharashtra State Bounding Box (South-West: [15.60, 72.65], North-East: [22.03, 80.90])
    var maharashtraBounds = L.latLngBounds(
      L.latLng(15.60, 72.65),
      L.latLng(22.03, 80.90)
    );

    var map = L.map('map', { 
      zoomControl: false,
      maxBounds: maharashtraBounds,
      maxBoundsViscosity: 1.0,
      minZoom: 6,
      maxZoom: 19
    }).setView([${activeRegion.latitude}, ${activeRegion.longitude}], ${Math.max(6, Math.round(getZoomFromRegion(activeRegion)))});
    
    var primaryTile = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      minZoom: 6,
      maxZoom: 19,
      bounds: maharashtraBounds,
      attribution: '&copy; Styrka Maps'
    });

    primaryTile.on('tileerror', function() {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        minZoom: 6,
        maxZoom: 19,
        bounds: maharashtraBounds
      }).addTo(map);
    });

    primaryTile.addTo(map);

    var dataGroup = L.layerGroup().addTo(map);

    window.renderData = function(markersData, polylinesData) {
      dataGroup.clearLayers();

      // Render Markers
      markersData.forEach(function(m) {
        var iconHtml;
        var titleText = m.title || 'Rider';
        if (m.isRider) {
          iconHtml = '<div class="rider-name-tag">' + titleText + '</div><div class="rider-pulse"><div class="navigation-arrow-symbol"><svg width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg></div></div>';
        } else if (m.color === '#10B981' || m.color === 'green') {
          iconHtml = '<div class="start-pin"></div>';
        } else {
          iconHtml = '<div class="dest-pin"></div>';
        }

        var customIcon = L.divIcon({
          className: 'custom-map-icon',
          html: iconHtml,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        L.marker([m.lat, m.lng], { icon: customIcon }).addTo(dataGroup);
      });


      // Render Polylines
      var allBounds = [];
      polylinesData.forEach(function(p) {
        if (p.coords && p.coords.length >= 2) {
          var poly = L.polyline(p.coords, { color: p.color, weight: p.weight, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(dataGroup);
          allBounds.push(poly.getBounds());
        }
      });

      if (allBounds.length > 0) {
        var combinedBounds = allBounds[0];
        for (var i = 1; i < allBounds.length; i++) {
          combinedBounds.extend(allBounds[i]);
        }
        map.fitBounds(combinedBounds, { padding: [40, 40] });
      }
    };

    window.renderData(${markersJson}, ${polylinesJson});
  </script>
</body>
</html>
  `;

  return (
    <View style={style || styles.map}>
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
      />
    </View>
  );
});


// ──────────────────────────────────────────────
// Exported MapView
// ──────────────────────────────────────────────
export const MapView = forwardRef((props: any, ref: any) => {
  return <UniversalWebViewMap ref={ref} {...props} />;
});

export const Marker = ({ coordinate, onPress, children, pinColor, id, title, ...props }: any) => {
  return children || null;
};

export const Polyline = ({ coordinates, strokeColor, strokeWidth, ...props }: any) => {
  return null;
};

export const Callout = ({ children, ...props }: any) => {
  return children || null;
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
