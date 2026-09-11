/**
 * Google Maps Platform REST API Client for Styrka.
 * Handles Places Autocomplete, Place Details, Directions, and Geocoding.
 * Includes graceful fallbacks to OSRM and Photon/Nominatim if API key is not yet provided or rate-limited.
 */
import { decodePolyline } from './mapsUtils';

const GOOGLE_MAPS_KEY = 
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
  process.env.GOOGLE_MAPS_API_KEY || 
  'AIzaSyBTEuKfeLP-6-RREJ49VqwlNmuKEI8jQmI';

export const GoogleMapsApi = {
  /**
   * Direction / Route calculation between Origin and Destination
   */
  direction: async (params: { origin: string; destination: string; profile?: string; overview?: string; geometries?: string }) => {
    const [originLng, originLat] = params.origin.split(',');
    const [destLng, destLat] = params.destination.split(',');

    // 1. Primary: Google Maps Directions API (if key is available)
    if (GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY') {
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${GOOGLE_MAPS_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const leg = route.legs && route.legs[0];
            return {
              routes: [{
                distance: leg?.distance?.value || 1000,
                duration: leg?.duration?.value || 300,
                geometry: route.overview_polyline?.points || '',
              }]
            };
          }
        }
      } catch (err) {
        console.warn('[GoogleMapsApi] Google Directions error:', err);
      }
    }

    // 2. High-accuracy OSRM Driving Engine Fallback
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      if (osrmData && osrmData.routes && osrmData.routes.length > 0 && osrmData.routes[0].geometry) {
        return osrmData;
      }
    } catch (error) {
      console.log('[GoogleMapsApi] OSRM Direction error:', error);
    }

    // Fallback straight line
    return {
      routes: [{
        distance: 1000,
        duration: 300,
        geometry: ''
      }]
    };
  },

  /**
   * Address AutoSuggest / Places Autocomplete
   */
  autoSuggest: async (params: { query: string }) => {
    if (!params.query || params.query.trim().length < 2) {
      return { suggestedLocations: [] };
    }

    const rawQuery = params.query.trim();
    const searchQuery = rawQuery.toLowerCase().includes('maharashtra') 
      ? rawQuery 
      : `${rawQuery}, Maharashtra`;

    // 1. Primary: Google Places Autocomplete API
    if (GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY') {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchQuery)}&components=country:in&key=${GOOGLE_MAPS_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.predictions && data.predictions.length > 0) {
            const results = data.predictions.map((p: any) => ({
              place_id: p.place_id,
              placeName: p.structured_formatting?.main_text || p.description,
              placeAddress: p.description,
              latitude: null,
              longitude: null,
            }));
            return { suggestedLocations: results };
          }
        }
      } catch (e) {
        console.warn('[GoogleMapsApi] Google Places autocomplete error:', e);
      }
    }

    const results: any[] = [];

    // 2. Photon Geocoding Engine (Fast, OpenStreetMap powered, zero rate limits)
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
                place_id: `${lat},${lng}`,
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
      console.warn('[GoogleMapsApi] Photon search error:', e);
    }

    // 3. Nominatim / OpenStreetMap Search Fallback
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
                  place_id: `${lat},${lon}`,
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
        console.warn('[GoogleMapsApi] Nominatim autoSuggest fallback error:', e);
      }
    }

    return { suggestedLocations: results };
  },

  /**
   * Place Detail via Google place_id or Coordinates
   */
  placeDetail: async (params: { placeId?: string; mapplsPin?: string }) => {
    const id = params.placeId || params.mapplsPin;
    if (!id) return null;

    // If ID contains coordinates (e.g. "18.5204,73.8567")
    if (id.includes(',')) {
      const [latStr, lngStr] = id.split(',');
      const latitude = parseFloat(latStr);
      const longitude = parseFloat(lngStr);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        return { latitude, longitude };
      }
    }

    // 1. Google Place Details API
    if (GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY') {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(id)}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.result && data.result.geometry && data.result.geometry.location) {
            return {
              latitude: data.result.geometry.location.lat,
              longitude: data.result.geometry.location.lng,
              formatted_address: data.result.formatted_address,
            };
          }
        }
      } catch (e) {
        console.error('[GoogleMapsApi] placeDetail error:', e);
      }
    }

    return null;
  },

  /**
   * Reverse Geocode (Lat/Lng to Address)
   */
  reverseGeocode: async (params: { latitude: number; longitude: number }) => {
    // 1. Google Geocoding API
    if (GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY') {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${params.latitude},${params.longitude}&key=${GOOGLE_MAPS_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.results && data.results.length > 0) {
            return {
              results: [{ formatted_address: data.results[0].formatted_address }]
            };
          }
        }
      } catch (e) {
        console.warn('[GoogleMapsApi] Google reverseGeocode error:', e);
      }
    }

    // 2. OpenStreetMap Nominatim Fallback
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
   * Geocode (Address to Lat/Lng)
   */
  geocode: async (params: { address: string }) => {
    // 1. Google Geocoding API
    if (GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY') {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(params.address)}&key=${GOOGLE_MAPS_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.results && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            return {
              results: [{
                latitude: loc.lat,
                longitude: loc.lng,
                formatted_address: data.results[0].formatted_address,
              }]
            };
          }
        }
      } catch (e) {
        console.warn('[GoogleMapsApi] Google geocode error:', e);
      }
    }

    const geoQuery = params.address.toLowerCase().includes('maharashtra')
      ? params.address
      : `${params.address}, Maharashtra`;

    // 2. Photon Geocoding Engine
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

    // 3. Nominatim API
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

export default GoogleMapsApi;
