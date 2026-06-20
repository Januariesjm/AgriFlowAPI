import { Router } from "express"
import { createServiceClient } from "../config/supabase"
import { requireAuth } from "../middleware/auth"

const router = Router()

// GET /api/profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user!.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: "Profile not found" })
    }

    res.json({ success: true, profile: data })
  } catch (err) {
    console.error("[profile/get]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PATCH /api/profile
router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const { full_name, phone, country, region, gps_lat, gps_lng, avatar_url } = req.body
    const supabase = createServiceClient()

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (full_name) updates.full_name = full_name
    if (phone !== undefined) updates.phone = phone
    if (country) updates.country = country
    if (region !== undefined) updates.region = region
    if (gps_lat !== undefined) updates.gps_lat = gps_lat
    if (gps_lng !== undefined) updates.gps_lng = gps_lng
    if (avatar_url !== undefined) updates.avatar_url = avatar_url

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", req.user!.id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ success: true, profile: data })
  } catch (err) {
    console.error("[profile/update]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
