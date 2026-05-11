// Free OSM geocoding (Nominatim) + OSRM driving distance.
// Public servers — keep usage modest (<1 req/sec).

export type GeoPoint = { lat: number; lon: number; label: string };

export async function geocode(query: string): Promise<GeoPoint | null> {
  if (!query.trim()) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data.length) return null;
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), label: data[0].display_name };
}

export async function drivingKm(from: GeoPoint, to: GeoPoint): Promise<number> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const json = (await res.json()) as { routes?: Array<{ distance: number }> };
  const meters = json.routes?.[0]?.distance;
  if (!meters && meters !== 0) throw new Error("No route found");
  return meters / 1000;
}

export async function estimateDrivingKm(start: string, end: string): Promise<{ km: number; from: GeoPoint; to: GeoPoint }> {
  const [a, b] = await Promise.all([geocode(start), geocode(end)]);
  if (!a) throw new Error(`Could not find: ${start}`);
  if (!b) throw new Error(`Could not find: ${end}`);
  const km = await drivingKm(a, b);
  return { km, from: a, to: b };
}

export function variancePct(actualKm: number, estimatedKm: number): number {
  if (!estimatedKm) return 0;
  return ((actualKm - estimatedKm) / estimatedKm) * 100;
}

export const VARIANCE_FLAG_PCT = 10;
