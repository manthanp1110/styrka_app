export function decodePolyline(encoded: string) {
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ latitude: (lat / 1E5), longitude: (lng / 1E5) });
  }
  return poly;
}

export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371; // Radius of the earth in km
  var dLat = (lat2-lat1) * (Math.PI/180);
  var dLon = (lon2-lon1) * (Math.PI/180); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

// ──────────────────────────────────────────────
// Maharashtra State Map Restriction Bounds
// ──────────────────────────────────────────────
export const MAHARASHTRA_BOUNDS = {
  minLat: 15.60,
  maxLat: 22.03,
  minLng: 72.65,
  maxLng: 80.90,
  centerLat: 19.7515,
  centerLng: 75.7139,
};

export function isWithinMaharashtra(lat: number, lng: number): boolean {
  return (
    lat >= MAHARASHTRA_BOUNDS.minLat &&
    lat <= MAHARASHTRA_BOUNDS.maxLat &&
    lng >= MAHARASHTRA_BOUNDS.minLng &&
    lng <= MAHARASHTRA_BOUNDS.maxLng
  );
}

export function clampToMaharashtra(lat: number, lng: number): { latitude: number; longitude: number } {
  const clampedLat = Math.min(Math.max(lat, MAHARASHTRA_BOUNDS.minLat), MAHARASHTRA_BOUNDS.maxLat);
  const clampedLng = Math.min(Math.max(lng, MAHARASHTRA_BOUNDS.minLng), MAHARASHTRA_BOUNDS.maxLng);
  return { latitude: clampedLat, longitude: clampedLng };
}
