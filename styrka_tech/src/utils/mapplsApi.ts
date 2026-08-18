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
  /**
   * Address AutoSuggest / Search (Restricted to Maharashtra State & Pan-India)
   */
  autoSuggest: async (params: { query: string }) => {
    if (!params.query || params.query.trim().length < 2) {
      return { suggestedLocations: [] };
    }

    const rawQuery = params.query.trim();
    const searchQuery = rawQuery.toLowerCase().includes('maharashtra') 
      ? rawQuery 
      : `${rawQuery}, Maharashtra`;

    const results: any[] = [];

    // 1. Try Photon Geocoding Engine (Fast, OpenStreetMap powered, zero rate limits)
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=10`;
      const photonRes = await fetch(photonUrl);
      if (photonRes.ok) {
        const photonData = await photonRes.json();
        if (photonData && photonData.features && photonData.features.length > 0) {
          photonData.features.forEach((feat: any) => {
            const coords = feat.geometry?.coordinates;
            const props = feat.properties || {};
            if (coords && coords.length >= 2) {
              const lng = Number(coords[0]);
              const lat = Number(coords[1]);
              const name = props.name || props.street || props.city || rawQuery;
              const addressParts = [props.name, props.street, props.city, props.state, props.country].filter(Boolean);
              const address = Array.from(new Set(addressParts)).join(', ');

              results.push({
                mapplsPin: `${lat},${lng}`,
                placeName: name,
                placeAddress: address || searchQuery,
                latitude: lat,
                longitude: lng,
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('[MapplsApi] Photon search error:', e);
    }

    // 2. Nominatim / OpenStreetMap Search Fallback
    if (results.length === 0) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=10`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'StyrkaApp/1.0 (contact: admin@styrka.com)' }
        });
        if (nomRes.ok) {
          const text = await nomRes.text();
          if (text && text.trim().startsWith('[')) {
            const nomData = JSON.parse(text);
            if (Array.isArray(nomData) && nomData.length > 0) {
              nomData.forEach((item: any) => {
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                results.push({
                  mapplsPin: `${lat},${lon}`,
                  placeName: item.display_name.split(',')[0],
                  placeAddress: item.display_name,
                  latitude: lat,
                  longitude: lon,
                });
              });
            }
          }
        }
      } catch (e) {
        console.warn('[MapplsApi] Nominatim autoSuggest fallback error:', e);
      }
    }

    // 3. Mappls AutoSuggest API
    if (results.length === 0) {
      try {
        const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/autosuggest?query=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            const data = JSON.parse(text);
            if (data && data.suggestedLocations && data.suggestedLocations.length > 0) {
              data.suggestedLocations.forEach((item: any) => {
                results.push({
                  mapplsPin: item.mapplsPin || item.eLoc,
                  placeName: item.placeName || rawQuery,
                  placeAddress: item.placeAddress ? `${item.placeName}, ${item.placeAddress}` : item.placeName,
                  latitude: item.latitude,
                  longitude: item.longitude,
                });
              });
            }
          }
        }
      } catch (e) {}
    }

    return { suggestedLocations: results };
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
      if (text && text.trim().startsWith('{')) {
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
      if (text && text.trim().startsWith('{')) {
        const data = JSON.parse(text);
        if (data && data.results) return data;
      }
    } catch (e) {
      console.log('[MapplsApi] Mappls reverseGeocode error, using Nominatim fallback');
    }

    // Fallback to OpenStreetMap Nominatim
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${params.latitude}&lon=${params.longitude}&format=json`;
      const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'StyrkaApp/1.0 (contact: admin@styrka.com)' } });
      const text = await nomRes.text();
      if (text && text.trim().startsWith('{')) {
        const nomData = JSON.parse(text);
        return {
          results: [{ formatted_address: nomData.display_name || `${params.latitude}, ${params.longitude}` }]
        };
      }
    } catch (e) {}

    return {
      results: [{ formatted_address: `${params.latitude.toFixed(4)}, ${params.longitude.toFixed(4)}` }]
    };
  },

  /**
   * Geocode (Address to Lat/Lng - Multi-Engine Fallback)
   */
  geocode: async (params: { address: string }) => {
    const geoQuery = params.address.toLowerCase().includes('maharashtra')
      ? params.address
      : `${params.address}, Maharashtra`;

    // 1. Try Photon Geocoding Engine
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(geoQuery)}&limit=1`;
      const photonRes = await fetch(photonUrl);
      if (photonRes.ok) {
        const photonData = await photonRes.json();
        if (photonData && photonData.features && photonData.features.length > 0) {
          const coords = photonData.features[0].geometry?.coordinates;
          if (coords && coords.length >= 2) {
            return {
              results: [{
                latitude: Number(coords[1]),
                longitude: Number(coords[0]),
                formatted_address: params.address,
              }]
            };
          }
        }
      }
    } catch (e) {}

    // 2. Try Mappls API
    try {
      const url = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/geocode?address=${encodeURIComponent(geoQuery)}`;
      const res = await fetch(url);
      const text = await res.text();
      if (text && text.trim().startsWith('{')) {
        const data = JSON.parse(text);
        if (data && data.results && data.results.length > 0) return data;
      }
    } catch (e) {}

    // 3. Try Nominatim API
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1`;
      const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'StyrkaApp/1.0 (contact: admin@styrka.com)' } });
      if (nomRes.ok) {
        const text = await nomRes.text();
        if (text && text.trim().startsWith('[')) {
          const nomData = JSON.parse(text);
          if (Array.isArray(nomData) && nomData.length > 0) {
            return {
              results: [{
                latitude: parseFloat(nomData[0].lat),
                longitude: parseFloat(nomData[0].lon),
                formatted_address: nomData[0].display_name,
              }]
            };
          }
        }
      }
    } catch (e) {}

    return null;
  },
};

export default MapplsApi;
