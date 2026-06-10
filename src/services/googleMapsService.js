const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const SUPERMARKET_KEYWORDS = ['Tesco', "Sainsbury's", 'ASDA', 'Lidl', 'Aldi', 'Morrisons', 'Waitrose'];

export async function getNearbyStores(lat, lng) {
  if (!MAPS_API_KEY) return { stores: [], error: 'Maps API key not configured' };

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=3000&type=supermarket&key=${MAPS_API_KEY}`;

  try {
    // Use a Cloudflare Worker proxy to avoid CORS
    const workerUrl = import.meta.env.VITE_MAPS_PROXY_URL || '/api/places';
    const res = await fetch(`${workerUrl}?lat=${lat}&lng=${lng}&radius=3000&type=supermarket`);
    if (!res.ok) throw new Error('Places API error');
    const data = await res.json();

    const stores = (data.results || [])
      .filter((p) => {
        const name = p.name || '';
        return SUPERMARKET_KEYWORDS.some((k) => name.toLowerCase().includes(k.toLowerCase()));
      })
      .slice(0, 6)
      .map((p) => ({
        placeId: p.place_id,
        name: p.name,
        address: p.vicinity,
        openNow: p.opening_hours?.open_now,
        rating: p.rating,
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        distance: getDistanceKm(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
      }))
      .sort((a, b) => a.distance - b.distance);

    return { stores };
  } catch (err) {
    return { stores: [], error: err.message };
  }
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getStaticMapUrl(stores) {
  if (!stores.length || !MAPS_API_KEY) return null;
  const markers = stores.map((s, i) => `markers=label:${i + 1}|${s.lat},${s.lng}`).join('&');
  const center = `${stores[0].lat},${stores[0].lng}`;
  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=13&size=600x300&${markers}&key=${MAPS_API_KEY}`;
}

export function buildDirectionsUrl(stores) {
  if (!stores.length) return '';
  const waypoints = stores.slice(1).map((s) => `${s.lat},${s.lng}`).join('|');
  const origin = `${stores[0].lat},${stores[0].lng}`;
  const dest = `${stores[stores.length - 1].lat},${stores[stores.length - 1].lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
}
