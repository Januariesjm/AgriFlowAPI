/**
 * Price Intelligence Engine
 * Cross-country price comparison with delivered cost calculation
 */

import { calculateDistance, estimateCountryTransportCost, COUNTRY_CENTERS } from "./transport"
import { createServiceClient } from "../config/supabase"

export interface PriceComparison {
  country: string
  region: string | null
  avg_price: number
  min_price: number
  max_price: number
  listing_count: number
  transport_estimate: number
  delivered_cost: number
  currency: string
}

/** Compare prices for a product across East African countries */
export async function comparePrices(
  productName: string,
  buyerLat: number,
  buyerLng: number,
  unit: string = "ton"
): Promise<PriceComparison[]> {
  const supabase = createServiceClient()

  // Get active listings for this product across all countries
  const { data: listings, error } = await supabase
    .from("products")
    .select("price, country, region, gps_lat, gps_lng, currency")
    .ilike("name", `%${productName}%`)
    .eq("status", "active")
    .eq("unit", unit)

  if (error || !listings || listings.length === 0) {
    return []
  }

  // Group by country
  const byCountry: Record<string, typeof listings> = {}
  for (const listing of listings) {
    const country = listing.country
    if (!byCountry[country]) byCountry[country] = []
    byCountry[country].push(listing)
  }

  // Calculate stats per country
  const results: PriceComparison[] = []

  for (const [country, countryListings] of Object.entries(byCountry)) {
    const prices = countryListings.map((l) => l.price)
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    // Use average GPS of listings in this country, or country center
    const avgLat = countryListings.reduce((a, l) => a + (l.gps_lat || 0), 0) / countryListings.length
    const avgLng = countryListings.reduce((a, l) => a + (l.gps_lng || 0), 0) / countryListings.length

    const fromLat = avgLat || COUNTRY_CENTERS[country]?.lat || 0
    const fromLng = avgLng || COUNTRY_CENTERS[country]?.lng || 0

    // Determine buyer's country from coordinates
    const buyerCountry = getBuyerCountry(buyerLat, buyerLng)
    const transportEstimate = estimateCountryTransportCost(
      country, buyerCountry,
      fromLat, fromLng,
      buyerLat, buyerLng
    )

    results.push({
      country,
      region: countryListings[0]?.region || null,
      avg_price: Math.round(avgPrice * 100) / 100,
      min_price: minPrice,
      max_price: maxPrice,
      listing_count: countryListings.length,
      transport_estimate: transportEstimate,
      delivered_cost: Math.round((avgPrice + transportEstimate) * 100) / 100,
      currency: countryListings[0]?.currency || "USD",
    })
  }

  // Sort by delivered cost (cheapest first)
  results.sort((a, b) => a.delivered_cost - b.delivered_cost)

  return results
}

/** Rough country detection from GPS coordinates */
function getBuyerCountry(lat: number, lng: number): string {
  let closest = "Kenya"
  let minDist = Infinity

  for (const [country, center] of Object.entries(COUNTRY_CENTERS)) {
    const dist = calculateDistance(lat, lng, center.lat, center.lng)
    if (dist < minDist) {
      minDist = dist
      closest = country
    }
  }

  return closest
}
