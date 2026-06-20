import { Router } from "express"
import { createServiceClient } from "../config/supabase"
import { requireAuth } from "../middleware/auth"
import { z } from "zod"

const router = Router()

const orderSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  delivery_lat: z.number().optional(),
  delivery_lng: z.number().optional(),
  delivery_address: z.string().optional(),
  notes: z.string().optional(),
})

// POST /api/orders
router.post("/orders", requireAuth, async (req, res) => {
  try {
    const body = orderSchema.parse(req.body)
    const supabase = createServiceClient()

    // Get product details
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", body.product_id)
      .eq("status", "active")
      .single()

    if (productError || !product) {
      return res.status(404).json({ error: "Product not found or no longer available" })
    }

    if (body.quantity > product.quantity) {
      return res.status(400).json({ error: "Requested quantity exceeds available stock" })
    }

    const unitPrice = product.price
    const totalPrice = Math.round(unitPrice * body.quantity * 100) / 100

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        buyer_id: req.user!.id,
        product_id: body.product_id,
        farmer_id: product.farmer_id,
        quantity: body.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        delivery_lat: body.delivery_lat,
        delivery_lng: body.delivery_lng,
        delivery_address: body.delivery_address,
        notes: body.notes,
        status: "pending",
      })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })

    // Update product quantity
    const newQuantity = product.quantity - body.quantity
    await supabase
      .from("products")
      .update({
        quantity: newQuantity,
        status: newQuantity <= 0 ? "sold" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.product_id)

    res.status(201).json({ success: true, order })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[orders/create]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/orders — role-aware listing
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const { status, role } = req.query
    const supabase = createServiceClient()

    // Get user's profile to determine role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user!.id)
      .single()

    let query = supabase
      .from("orders")
      .select(`
        *,
        product:products(name, category, images, unit),
        buyer:profiles!orders_buyer_id_fkey(full_name, email, phone),
        farmer:profiles!orders_farmer_id_fkey(full_name, email, phone)
      `)
      .order("created_at", { ascending: false })

    // Filter by role
    if (profile?.role === "farmer") {
      query = query.eq("farmer_id", req.user!.id)
    } else if (profile?.role === "buyer") {
      query = query.eq("buyer_id", req.user!.id)
    }

    if (status) query = query.eq("status", status as string)

    const { data, error } = await query

    if (error) return res.status(400).json({ error: error.message })
    res.json({ success: true, orders: data })
  } catch (err) {
    console.error("[orders/list]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/orders/:id
router.get("/orders/:id", requireAuth, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        product:products(*),
        buyer:profiles!orders_buyer_id_fkey(full_name, email, phone, country, region),
        farmer:profiles!orders_farmer_id_fkey(full_name, email, phone, country, region)
      `)
      .eq("id", req.params.id)
      .single()

    if (error || !data) return res.status(404).json({ error: "Order not found" })

    // Only allow buyer, farmer, or admin to view
    if (data.buyer_id !== req.user!.id && data.farmer_id !== req.user!.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", req.user!.id)
        .single()
      if (profile?.role !== "admin") {
        return res.status(403).json({ error: "Not authorized" })
      }
    }

    res.json({ success: true, order: data })
  } catch (err) {
    console.error("[orders/get]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PATCH /api/orders/:id/status
router.patch("/orders/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ["confirmed", "in_transit", "delivered", "cancelled"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single()

    if (error || !data) return res.status(404).json({ error: "Order not found" })
    res.json({ success: true, order: data })
  } catch (err) {
    console.error("[orders/status]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
