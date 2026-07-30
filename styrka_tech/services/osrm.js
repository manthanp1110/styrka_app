/**
 * Mappls Routing and Map Matching Services
 */
const fetch = require('node-fetch');
const config = require('../config');

// Snapping coordinates onto the nearest road utilizing Mappls Reverse Geocoding
async function snapToNearestRoad(latitude, longitude) {
  if (!config.MAPPLS_ATLAS_REST_API_KEY) {
    console.warn('[Map Snapping Service] Mappls API key is missing.');
    return null;
  }

  const url = `https://apis.mappls.com/advancedmaps/v1/${config.MAPPLS_ATLAS_REST_API_KEY}/rev_geocode?lat=${latitude}&lng=${longitude}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.OSRM_TIMEOUT_MS);
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    
    if (data.responseCode === 200 && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        // Mappls returns lat/lng as strings in some APIs, parse them
        latitude: parseFloat(result.lat) || latitude,
        longitude: parseFloat(result.lng) || longitude,
        roadName: result.street || result.formatted_address || 'Unnamed Road'
      };
    }
  } catch (err) {
    console.warn('[Map Snapping Service] Failed to snap coordinate with Mappls:', err.message);
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

module.exports = {
  snapToNearestRoad
};
