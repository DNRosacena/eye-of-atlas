/**
 * Geocoding: Nominatim -> Google Geocoding shape.
 *
 * Shared by BOTH runtimes on purpose:
 *   - the Vite dev server middleware (vite.config.js)
 *   - the deployed Cloudflare Worker (worker/index.js)
 *
 * Two implementations of this would drift, and the drift would be invisible:
 * search would behave one way locally and another in production. Keep this
 * module free of Node and Worker specifics — pure data mapping only, with the
 * caller supplying fetch and caching.
 *
 * Nominatim policy obligations live with the CALLERS, because they differ per
 * runtime: 1 request/second, results must be cached, and an identifying
 * User-Agent (COMMERCIAL_COMPLIANCE.md §6.4).
 */

/** User-Agent both runtimes send. Nominatim requires the app be identifiable. */
export const GEOCODE_USER_AGENT = 'EyeOfAtlas/0.1 (+https://github.com/DNRosacena/eye-of-atlas)';

/** Nominatim forward-geocode endpoint. */
export const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';

/** Build the upstream query. `bias` is viewportBias()'s "swLat,swLng|neLat,neLng". */
export function buildNominatimUrl(query, bias) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
    'accept-language': 'en',
  });
  const viewbox = biasToViewbox(bias);
  // bounded=0 -> prefer the current view, but still find places outside it.
  if (viewbox) { params.set('viewbox', viewbox); params.set('bounded', '0'); }
  return `${NOMINATIM_SEARCH}?${params}`;
}

export function nominatimTypesToGoogle(entry) {
  const addressType = String(entry?.addresstype || '').toLowerCase();
  const category = String(entry?.category || entry?.class || '').toLowerCase();
  const type = String(entry?.type || '').toLowerCase();
  const out = [];
  const push = (...t) => { for (const v of t) if (!out.includes(v)) out.push(v); };

  if (addressType === 'country' || type === 'country') push('country', 'political');
  else if (addressType === 'state' || type === 'state') push('administrative_area_level_1', 'political');
  else if (addressType === 'county' || type === 'county') push('administrative_area_level_2', 'political');
  else if (['city', 'town', 'municipality'].includes(addressType) || ['city', 'town'].includes(type)) push('locality', 'political');
  else if (['village', 'hamlet'].includes(addressType) || ['village', 'hamlet'].includes(type)) push('locality', 'political');
  else if (['suburb', 'neighbourhood', 'quarter', 'borough'].includes(addressType)) push('sublocality', 'neighborhood', 'political');
  else if (addressType === 'postcode' || type === 'postcode') push('postal_code');
  else if (category === 'highway') push('route');
  else if (category === 'natural') push('natural_feature');
  else if (category === 'leisure' && type === 'park') push('park');
  else if (category === 'boundary') push('administrative_area_level_1', 'political');

  if (!out.length) push('point_of_interest', 'establishment');
  return out;
}
export function nominatimToGoogleGeocode(payload) {
  const entry = Array.isArray(payload) ? payload[0] : null;
  const lat = Number(entry?.lat);
  const lon = Number(entry?.lon);
  if (!entry || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { status: 'ZERO_RESULTS', results: [] };
  }
  const bb = Array.isArray(entry.boundingbox) ? entry.boundingbox.map(Number) : null;
  const geometry = { location: { lat, lng: lon } };
  if (bb && bb.length === 4 && bb.every(Number.isFinite)) {
    geometry.viewport = {
      southwest: { lat: bb[0], lng: bb[2] },
      northeast: { lat: bb[1], lng: bb[3] },
    };
  }
  return {
    status: 'OK',
    results: [{
      formatted_address: String(entry.display_name || '').trim(),
      types: nominatimTypesToGoogle(entry),
      geometry,
    }],
  };
}
export function biasToViewbox(bias) {
  const m = /^(-?[\d.]+),(-?[\d.]+)\|(-?[\d.]+),(-?[\d.]+)$/.exec(String(bias || '').trim());
  if (!m) return null;
  const [swLat, swLng, neLat, neLng] = m.slice(1).map(Number);
  if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) return null;
  return `${swLng},${neLat},${neLng},${swLat}`;
}
