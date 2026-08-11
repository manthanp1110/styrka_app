/**
 * OSRM (Open Source Routing Machine) Service Integration
 */
const config = require('../config');

async function getDrivingRoute(originLat, originLng, destLat, destLng) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.OSRM_TIMEOUT_MS || 3000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM API status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('[OSRM Service] Driving route request failed:', error.message);
    return null;
  }
}

module.exports = {
  getDrivingRoute,
};
