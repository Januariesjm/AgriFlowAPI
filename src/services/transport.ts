/**
 * Transport Cost Calculation Engine
 * Uses Haversine formula for distance + rate-based cost estimation
 */

/** Calculate distance between two GPS coordinates in kilometers */
export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 100) / 100
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/** Default transport rates per km by vehicle type (USD) */
export const TRANSPORT_RATES: Record<string, number> = {
  pickup: 0.8,
  van: 1.0,
  truck: 1.5,
  lorry: 2.0,
}

/** Cross-border additional costs (USD flat fee) */
export const BORDER_CROSSING_FEES: Record<string, number> = {
  "Kenya-Uganda": 50,
  "Uganda-Kenya": 50,
  "Kenya-Tanzania": 60,
  "Tanzania-Kenya": 60,
  "Uganda-Tanzania": 55,
  "Tanzania-Uganda": 55,
  "Kenya-Rwanda": 80,
  "Rwanda-Kenya": 80,
  "Uganda-Rwanda": 45,
  "Rwanda-Uganda": 45,
  "Tanzania-Rwanda": 70,
  "Rwanda-Tanzania": 70,
}

/** Calculate transport cost */
export function calculateTransportCost(
  distanceKm: number,
  ratePerKm: number = TRANSPORT_RATES.truck,
  weightTons: number = 1,
  crossBorderFee: number = 0
): number {
  const baseCost = distanceKm * ratePerKm
  const weightMultiplier = Math.max(1, weightTons * 0.5)
  return Math.round((baseCost * weightMultiplier + crossBorderFee) * 100) / 100
}

/** Estimate transport cost between two countries */
export function estimateCountryTransportCost(
  fromCountry: string,
  toCountry: string,
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  weightTons: number = 1
): number {
  const distance = calculateDistance(fromLat, fromLng, toLat, toLng)
  const borderKey = `${fromCountry}-${toCountry}`
  const crossBorderFee = fromCountry !== toCountry
    ? (BORDER_CROSSING_FEES[borderKey] || 50)
    : 0
  return calculateTransportCost(distance, TRANSPORT_RATES.truck, weightTons, crossBorderFee)
}

/** Country capital coordinates for rough transport estimates */
export const COUNTRY_CENTERS: Record<string, { lat: number; lng: number; name: string }> = {
  Kenya: { lat: -1.2921, lng: 36.8219, name: "Nairobi" },
  Uganda: { lat: 0.3476, lng: 32.5825, name: "Kampala" },
  Tanzania: { lat: -6.7924, lng: 39.2083, name: "Dar es Salaam" },
  Rwanda: { lat: -1.9403, lng: 29.8739, name: "Kigali" },
}
