import { Router } from "express"
import { createServiceClient } from "../config/supabase"
import { comparePrices } from "../services/pricing"
import { z } from "zod"

const router = Router()

// GET /api/prices/compare?product=maize&buyer_lat=-1.2&buyer_lng=36.8
router.get("/prices/compare", async (req, res) => {
  try {
    const { product, buyer_lat, buyer_lng, unit } = req.query

    if (!product || !buyer_lat || !buyer_lng) {
      return res.status(400).json({
        error: "Missing required parameters: product, buyer_lat, buyer_lng",
      })
    }

    const results = await comparePrices(
      product as string,
      Number(buyer_lat),
      Number(buyer_lng),
      (unit as string) || "ton"
    )

    const cheapest = results.length > 0 ? results[0] : null

    res.json({
      success: true,
      product: product as string,
      buyer_location: { lat: Number(buyer_lat), lng: Number(buyer_lng) },
      comparisons: results,
      cheapest_delivered: cheapest
        ? {
            country: cheapest.country,
            delivered_cost: cheapest.delivered_cost,
            savings_vs_most_expensive:
              results.length > 1
                ? Math.round((results[results.length - 1].delivered_cost - cheapest.delivered_cost) * 100) / 100
                : 0,
          }
        : null,
    })
  } catch (err) {
    console.error("[prices/compare]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/prices/history?product=maize&country=Kenya&months=12
router.get("/prices/history", async (req, res) => {
  try {
    const { product, country, months = "12" } = req.query
    const supabase = createServiceClient()

    const fromDate = new Date()
    fromDate.setMonth(fromDate.getMonth() - Number(months))

    let query = supabase
      .from("price_history")
      .select("*")
      .gte("recorded_at", fromDate.toISOString())
      .order("recorded_at", { ascending: true })

    if (product) query = query.ilike("product_name", `%${product}%`)
    if (country) query = query.eq("country", country as string)

    const { data, error } = await query

    if (error) return res.status(400).json({ error: error.message })
    res.json({ success: true, history: data })
  } catch (err) {
    console.error("[prices/history]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/prices/latest — current average prices by crop
router.get("/prices/latest", async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("products")
      .select("name, category, country, price, unit, currency")
      .eq("status", "active")
      .order("name")

    if (error) return res.status(400).json({ error: error.message })

    // Aggregate by crop + country
    const aggregated: Record<string, { crop: string; country: string; avg_price: number; count: number; unit: string; currency: string }> = {}

    for (const p of data || []) {
      const key = `${p.name}-${p.country}`
      if (!aggregated[key]) {
        aggregated[key] = { crop: p.name, country: p.country, avg_price: 0, count: 0, unit: p.unit, currency: p.currency }
      }
      aggregated[key].avg_price += p.price
      aggregated[key].count++
    }

    const prices = Object.values(aggregated).map((a) => ({
      ...a,
      avg_price: Math.round((a.avg_price / a.count) * 100) / 100,
    }))

    res.json({ success: true, prices })
  } catch (err) {
    console.error("[prices/latest]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
