export interface Point {
  lat: number;
  lng: number;
}

export function distanceM(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(x));
}

/**
 * Rough walking time. Streets are rarely straight, so the straight-line distance
 * is stretched by 1.3 and walked at 4.5 km/h. Shown as an estimate only.
 */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.3) / 75));
}

export function googleMapsUrl(p: Point): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;
}

export function appleMapsUrl(p: Point): string {
  return `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=w`;
}
