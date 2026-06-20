import { Router } from "express"
import { createServiceClient } from "../config/supabase"
import { requireAuth } from "../middleware/auth"
import { calculateDistance, calculateTransportCost, TRANSPORT_RATES } from "../services/transport"
import { z } from "zod"

const router = Router()

const vehicleSchema = z.object({
  type: z.string().min(1),
  capacity_tons: z.number().positive(),
  plate_number: z.string().min(1),
  price_per_km: z.number().positive(),
})

const transportRequestSchema = z.object({
  order_id: z.string().uuid().optional(),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  delivery_lat: z.number(),
  delivery_lng: z.number(),
})

// GET /api/transport/cost
router.get("/transport/cost", async (req, res) => {
  try {
    const { from_lat, from_lng, to_lat, to_lng, weight, vehicle_type } = req.query

    if (!from_lat || !from_lng || !to_lat || !to_lng) {
      return res.status(400).json({ error: "Missing required coordinates" })
    }

    const distance = calculateDistance(
      Number(from_lat), Number(from_lng),
      Number(to_lat), Number(to_lng)
    )

    const rate = TRANSPORT_RATES[(vehicle_type as string) || "truck"] || TRANSPORT_RATES.truck
    const cost = calculateTransportCost(distance, rate, Number(weight) || 1)

    res.json({
      success: true,
      distance_km: distance,
      vehicle_type: (vehicle_type as string) || "truck",
      rate_per_km: rate,
      weight_tons: Number(weight) || 1,
      estimated_cost: cost,
      currency: "USD",
    })
  } catch (err) {
    console.error("[transport/cost]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/transport/vehicles
router.get("/transport/vehicles", async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("vehicles")
      .select("*, profiles!vehicles_transporter_id_fkey(full_name, phone, country, region)")
      .eq("is_available", true)
      .order("price_per_km", { ascending: true })

    if (error) return res.status(400).json({ error: error.message })
    res.json({ success: true, vehicles: data })
  } catch (err) {
    console.error("[transport/vehicles]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/transport/vehicles
router.post("/transport/vehicles", requireAuth, async (req, res) => {
  try {
    const body = vehicleSchema.parse(req.body)
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("vehicles")
      .insert({ ...body, transporter_id: req.user!.id })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json({ success: true, vehicle: data })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[transport/vehicles/create]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/transport/request
router.post("/transport/request", requireAuth, async (req, res) => {
  try {
    const body = transportRequestSchema.parse(req.body)
    const supabase = createServiceClient()

    const distance = calculateDistance(
      body.pickup_lat, body.pickup_lng,
      body.delivery_lat, body.delivery_lng
    )
    const estimatedCost = calculateTransportCost(distance, TRANSPORT_RATES.truck)

    const { data, error } = await supabase
      .from("transport_requests")
      .insert({
        ...body,
        requester_id: req.user!.id,
        distance_km: distance,
        estimated_cost: estimatedCost,
        status: "pending",
      })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json({ success: true, transport_request: data })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[transport/request]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/transport/requests
router.get("/transport/requests", requireAuth, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user!.id)
      .single()

    let query = supabase
      .from("transport_requests")
      .select("*, vehicle:vehicles(*)")
      .order("created_at", { ascending: false })

    if (profile?.role === "transporter") {
      query = query.or(`transporter_id.eq.${req.user!.id},status.eq.pending`)
    } else {
      query = query.eq("requester_id", req.user!.id)
    }

    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json({ success: true, requests: data })
  } catch (err) {
    console.error("[transport/requests]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PATCH /api/transport/requests/:id
router.patch("/transport/requests/:id", requireAuth, async (req, res) => {
  try {
    const { status, vehicle_id } = req.body
    const supabase = createServiceClient()

    const updates: Record<string, any> = {}
    if (status) updates.status = status
    if (vehicle_id) updates.vehicle_id = vehicle_id
    if (status === "accepted") {
      updates.transporter_id = req.user!.id
    }

    const { data, error } = await supabase
      .from("transport_requests")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single()

    if (error || !data) return res.status(404).json({ error: "Request not found" })
    res.json({ success: true, transport_request: data })
  } catch (err) {
    console.error("[transport/requests/update]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
