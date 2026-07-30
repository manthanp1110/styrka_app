/**
 * Robust Mappls REST API client.
 * Falls back to direct Mappls HTTPS REST endpoints when native Mappls modules are unavailable (e.g., Expo Go).
 */
import { decodePolyline } from './mapsUtils';

const MAPPLS_KEY = 
  process.env.EXPO_PUBLIC_MAPPLS_API_KEY || 
  process.env.MAPPLS_API_KEY || 
  'mbukurbbkmusokbnskezflvgncgpmexqlnlm';

let NativeRestApi: any = null;
try {
  const mappls = require('mappls-map-react-native');
  NativeRestApi = mappls.RestApi || null;
} catch (e) {
  NativeRestApi = null;
}

export const MapplsApi = {
  /**
   * Direction / Route calculation between Origin and Destination
   */
  direction: async (params: { origin: string; destination: string; profile?: string; overview?: string; geometries?: string }) => {
    // 1. Try Native Mappls RestApi if available
    if (NativeRestApi && typeof NativeRestApi.direction === 'function') {
      try {
        const nativeRes = await NativeRestApi.direction(params);
        if (nativeRes && nativeRes.routes) return nativeRes;
      } catch (err) {
        console.log('[MapplsApi] Native direction failed, using REST fallback:', err);
      }
    }

    // 2. Direct HTTPS REST API Fallback
    try {
      const [originLng, originLat] = params.origin.split(',');
      const [destLng, destLat] = params.destination.split(',');
      
      // Mappls Direction REST API endpoint
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/route_adv/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.routes && data.routes.length > 0) {
        return data;
      }

      // OSRM / OpenRoute fallback if key is unconfigured or rate limited
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      return osrmData;
    } catch (error) {
      console.error('[MapplsApi] Direction error:', error);
      throw error;
    }
  },

  /**
   * Address AutoSuggest
   */
  autoSuggest: async (params: { query: string }) => {
    if (NativeRestApi && typeof NativeRestApi.autoSuggest === 'function') {
      try {
        const res = await NativeRestApi.autoSuggest(params);
        if (res && res.suggestedLocations) return res;
      } catch (err) {
        console.log('[MapplsApi] Native autoSuggest failed:', err);
      }
    }

    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/autosuggest?query=${encodeURIComponent(params.query)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('[MapplsApi] autoSuggest error:', e);
      return { suggestedLocations: [] };
    }
  },

  /**
   * Place Detail via Mappls Pin / eLoc
   */
  placeDetail: async (params: { mapplsPin: string }) => {
    if (NativeRestApi && typeof NativeRestApi.placeDetail === 'function') {
      try {
        const res = await NativeRestApi.placeDetail(params);
        if (res) return res;
      } catch (err) {
        console.log('[MapplsApi] Native placeDetail failed:', err);
      }
    }

    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/place_detail?eloc=${encodeURIComponent(params.mapplsPin)}`;
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      console.error('[MapplsApi] placeDetail error:', e);
      return null;
    }
  },

  /**
   * Reverse Geocode (Lat/Lng to Address)
   */
  reverseGeocode: async (params: { latitude: number; longitude: number }) => {
    if (NativeRestApi && typeof NativeRestApi.reverseGeocode === 'function') {
      try {
        const res = await NativeRestApi.reverseGeocode(params);
        if (res) return res;
      } catch (err) {
        console.log('[MapplsApi] Native reverseGeocode failed:', err);
      }
    }

    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/rev_geocode?lat=${params.latitude}&lng=${params.longitude}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.results) return data;

      // Fallback to OpenStreetMap Nominatim
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${params.latitude}&lon=${params.longitude}&format=json`;
      const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'StyrkaApp/1.0' } });
      const nomData = await nomRes.json();
      return {
        results: [{ formatted_address: nomData.display_name }]
      };
    } catch (e) {
      console.error('[MapplsApi] reverseGeocode error:', e);
      return null;
    }
  },

  /**
   * Geocode (Address to Lat/Lng)
   */
  geocode: async (params: { address: string }) => {
    if (NativeRestApi && typeof NativeRestApi.geocode === 'function') {
      try {
        const res = await NativeRestApi.geocode(params);
        if (res) return res;
      } catch (err) {
        console.log('[MapplsApi] Native geocode failed:', err);
      }
    }

    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/geocode?address=${encodeURIComponent(params.address)}`;
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      console.error('[MapplsApi] geocode error:', e);
      return null;
    }
  }
};

export default MapplsApi;
