import { Router } from "express"
import { createServiceClient } from "../config/supabase"
import { requireAuth } from "../middleware/auth"
import { z } from "zod"

const router = Router()

const farmSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  country: z.string().min(1),
  region: z.string().min(1),
  farm_size: z.number().positive().optional(),
  soil_type: z.string().optional(),
  water_source: z.string().optional(),
  gps_lat: z.number(),
  gps_lng: z.number(),
})

// GET /api/farms
router.get("/farms", requireAuth, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("farms")
      .select("*")
      .eq("farmer_id", req.user!.id)
      .order("created_at", { ascending: false })

    if (error) return res.status(400).json({ error: error.message })
    res.json({ success: true, farms: data })
  } catch (err) {
    console.error("[farms/list]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/farms
router.post("/farms", requireAuth, async (req, res) => {
  try {
    const body = farmSchema.parse(req.body)
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("farms")
      .insert({ ...body, farmer_id: req.user!.id })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json({ success: true, farm: data })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[farms/create]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/farms/:id
router.get("/farms/:id", requireAuth, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("farms")
      .select("*")
      .eq("id", req.params.id)
      .eq("farmer_id", req.user!.id)
      .single()

    if (error || !data) return res.status(404).json({ error: "Farm not found" })
    res.json({ success: true, farm: data })
  } catch (err) {
    console.error("[farms/get]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PUT /api/farms/:id
router.put("/farms/:id", requireAuth, async (req, res) => {
  try {
    const body = farmSchema.partial().parse(req.body)
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("farms")
      .update(body)
      .eq("id", req.params.id)
      .eq("farmer_id", req.user!.id)
      .select()
      .single()

    if (error || !data) return res.status(404).json({ error: "Farm not found" })
    res.json({ success: true, farm: data })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[farms/update]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
