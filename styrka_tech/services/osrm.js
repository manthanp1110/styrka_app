/**
 * OSRM Routing and Map Matching Services
 */
const fetch = require('node-fetch');
const config = require('../config');

// Snapping coordinates onto the nearest road utilizing OSRM nearest service
async function snapToNearestRoad(latitude, longitude) {
  const url = `https://router.project-osrm.org/nearest/v1/driving/${longitude},${latitude}?number=1`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.OSRM_TIMEOUT_MS);
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    
    if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
      const snappedCoords = data.waypoints[0].location; // [lng, lat]
      return {
        latitude: snappedCoords[1],
        longitude: snappedCoords[0],
        roadName: data.waypoints[0].name || 'Unnamed Road'
      };
    }
  } catch (err) {
    console.warn('[Map Snapping Service] Failed to snap coordinate:', err.message);
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

module.exports = {
  snapToNearestRoad
};
