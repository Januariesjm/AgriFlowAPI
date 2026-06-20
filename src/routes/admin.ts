import { Router } from "express"
import { createServiceClient } from "../config/supabase"
import { requireAuth } from "../middleware/auth"
import { requireAdmin } from "../middleware/adminAuth"

const router = Router()

// GET /api/admin/stats
router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const supabase = createServiceClient()

    const [profilesRes, productsRes, ordersRes] = await Promise.all([
      supabase.from("profiles").select("id, role"),
      supabase.from("products").select("id, price, status"),
      supabase.from("orders").select("id, total_price, status")
    ])

    if (profilesRes.error) throw new Error(profilesRes.error.message)
    if (productsRes.error) throw new Error(productsRes.error.message)
    if (ordersRes.error) throw new Error(ordersRes.error.message)

    const profiles = profilesRes.data || []
    const products = productsRes.data || []
    const orders = ordersRes.data || []

    const userCount = profiles.length
    const farmerCount = profiles.filter(p => p.role === "farmer").length
    const buyerCount = profiles.filter(p => p.role === "buyer").length
    const transporterCount = profiles.filter(p => p.role === "transporter").length

    const activeProductCount = products.filter(p => p.status === "active").length
    const totalRevenue = orders
      .filter(o => o.status !== "cancelled")
      .reduce((sum, o) => sum + (o.total_price || 0), 0)

    res.json({
      success: true,
      stats: {
        users: { total: userCount, farmers: farmerCount, buyers: buyerCount, transporters: transporterCount },
        products: { active: activeProductCount, total: products.length },
        orders: { total: orders.length, revenue: Math.round(totalRevenue * 100) / 100 }
      }
    })
  } catch (err) {
    console.error("[admin/stats]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/admin/users
router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) return res.status(400).json({ error: error.message })
    res.json({ success: true, users: data })
  } catch (err) {
    console.error("[admin/users]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PATCH /api/admin/users/:id
router.patch("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { is_verified } = req.body
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("profiles")
      .update({ is_verified, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single()

    if (error || !data) return res.status(404).json({ error: "User not found" })
    res.json({ success: true, user: data })
  } catch (err) {
    console.error("[admin/users/verify]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
