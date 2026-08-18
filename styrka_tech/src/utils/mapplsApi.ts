/**
 * Robust Mappls REST API client.
 * Falls back to direct Mappls HTTPS REST endpoints, Nominatim, and OSRM
 * when native Mappls modules or API keys encounter errors.
 */
import { decodePolyline } from './mapsUtils';

const MAPPLS_KEY = 
  process.env.EXPO_PUBLIC_MAPPLS_API_KEY || 
  process.env.MAPPLS_API_KEY || 
  '28b2df366fa28c4d538d96c1b5cf32fb';

let NativeRestApi: any = null;

export const MapplsApi = {
  /**
   * Direction / Route calculation between Origin and Destination
   */
  direction: async (params: { origin: string; destination: string; profile?: string; overview?: string; geometries?: string }) => {
    const [originLng, originLat] = params.origin.split(',');
    const [destLng, destLat] = params.destination.split(',');

    // Primary: High-accuracy OSRM Driving Road Geometry Engine
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      if (osrmData && osrmData.routes && osrmData.routes.length > 0 && osrmData.routes[0].geometry) {
        return osrmData;
      }
    } catch (error) {
      console.log('[MapplsApi] OSRM Direction error:', error);
    }

    // Secondary: Mappls REST API
    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/route_adv/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline`;
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.routes && data.routes.length > 0) return data;
    } catch (err) {
      console.log('[MapplsApi] Mappls direction error:', err);
    }

    // Fallback
    return {
      routes: [{
        distance: 1000,
        duration: 300,
        geometry: ''
      }]
    };
  },


  /**
   * Address AutoSuggest / Search (Restricted to Maharashtra State)
   */
  autoSuggest: async (params: { query: string }) => {
    if (!params.query || params.query.trim().length < 2) {
      return { suggestedLocations: [] };
    }

    const searchQuery = params.query.toLowerCase().includes('maharashtra') 
      ? params.query 
      : `${params.query}, Maharashtra`;

    // 1. Try Mappls AutoSuggest API
    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/autosuggest?query=${encodeURIComponent(searchQuery)}&filter=bounds:15.60,72.65;22.03,80.90`;
      const res = await fetch(url);
      const text = await res.text();
      if (text) {
        const data = JSON.parse(text);
        if (data && data.suggestedLocations && data.suggestedLocations.length > 0) {
          // Filter results strictly within Maharashtra
          const filtered = data.suggestedLocations.filter((item: any) => {
            const addr = (item.placeAddress || item.placeName || '').toLowerCase();
            return addr.includes('maharashtra') || addr.includes('pune') || addr.includes('mumbai') || addr.includes('nagpur') || addr.includes('nashik') || addr.includes('kolhapur');
          });
          return { suggestedLocations: filtered.length > 0 ? filtered : data.suggestedLocations };
        }
      }
    } catch (e) {
      console.log('[MapplsApi] Mappls autoSuggest error, using Nominatim fallback:', e);
    }

    // 2. Nominatim / OpenStreetMap Search Fallback (Bounded to Maharashtra)
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=10&viewbox=72.65,22.03,80.90,15.60&bounded=1`;
      const nomRes = await fetch(nomUrl, {
        headers: { 'User-Agent': 'StyrkaApp/1.0 (contact: admin@styrka.com)' }
      });
      const text = await nomRes.text();
      if (text && text.trim().startsWith('[')) {
        const nomData = JSON.parse(text);
        if (Array.isArray(nomData) && nomData.length > 0) {
          const suggestedLocations = nomData
            .filter((item: any) => {
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              const isMHCoords = lat >= 15.60 && lat <= 22.03 && lon >= 72.65 && lon <= 80.90;
              const isMHAddress = (item.display_name || '').toLowerCase().includes('maharashtra');
              return isMHCoords || isMHAddress;
            })
            .map((item: any) => ({
              mapplsPin: `${item.lat},${item.lon}`,
              placeName: item.display_name.split(',')[0],
              placeAddress: item.display_name,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon)
            }));
          return { suggestedLocations };
        }
      }
    } catch (e) {
      console.warn('[MapplsApi] Nominatim autoSuggest fallback error:', e);
    }

    return { suggestedLocations: [] };
  },

  /**
   * Place Detail via Mappls Pin or Coordinates
   */
  placeDetail: async (params: { mapplsPin: string }) => {
    // If mapplsPin contains coordinates (e.g. "18.5204,73.8567")
    if (params.mapplsPin && params.mapplsPin.includes(',')) {
      const [latStr, lngStr] = params.mapplsPin.split(',');
      const latitude = parseFloat(latStr);
      const longitude = parseFloat(lngStr);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        return { latitude, longitude };
      }
    }

    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/place_detail?eloc=${encodeURIComponent(params.mapplsPin)}`;
      const res = await fetch(url);
      const text = await res.text();
      if (text) {
        const data = JSON.parse(text);
        if (data && data.latitude && data.longitude) return data;
      }
    } catch (e) {
      console.error('[MapplsApi] placeDetail error:', e);
    }

    return null;
  },

  /**
   * Reverse Geocode (Lat/Lng to Address)
   */
  reverseGeocode: async (params: { latitude: number; longitude: number }) => {
    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/rev_geocode?lat=${params.latitude}&lng=${params.longitude}`;
      const res = await fetch(url);
      const text = await res.text();
      if (text) {
        const data = JSON.parse(text);
        if (data && data.results) return data;
      }
    } catch (e) {
      console.log('[MapplsApi] Mappls reverseGeocode error, using Nominatim fallback');
    }

    // Fallback to OpenStreetMap Nominatim
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${params.latitude}&lon=${params.longitude}&format=json`;
      const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'StyrkaApp/1.0' } });
      const nomData = await nomRes.json();
      return {
        results: [{ formatted_address: nomData.display_name || `${params.latitude}, ${params.longitude}` }]
      };
    } catch (e) {
      return {
        results: [{ formatted_address: `${params.latitude.toFixed(4)}, ${params.longitude.toFixed(4)}` }]
      };
    }
  },

  /**
   * Geocode (Address to Lat/Lng - Restricted to Maharashtra State)
   */
  geocode: async (params: { address: string }) => {
    const geoQuery = params.address.toLowerCase().includes('maharashtra')
      ? params.address
      : `${params.address}, Maharashtra`;

    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/geocode?address=${encodeURIComponent(geoQuery)}`;
      const res = await fetch(url);
      const text = await res.text();
      if (text) {
        const data = JSON.parse(text);
        if (data && data.results) return data;
      }
    } catch (e) {
      console.log('[MapplsApi] Mappls geocode error, using Nominatim fallback');
    }

    // Fallback to Nominatim bounded to Maharashtra
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1&viewbox=72.65,22.03,80.90,15.60&bounded=1`;
      const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'StyrkaApp/1.0' } });
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        return {
          results: [{
            latitude: parseFloat(nomData[0].lat),
            longitude: parseFloat(nomData[0].lon)
          }]
        };
      }
    } catch (e) {
      console.error('[MapplsApi] Geocode fallback error:', e);
    }

    return null;
  }
};

export default MapplsApi;
