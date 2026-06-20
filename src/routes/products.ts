import { Router } from "express"
import { createServiceClient } from "../config/supabase"
import { requireAuth, optionalAuth } from "../middleware/auth"
import { z } from "zod"

const router = Router()

const productSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  price: z.number().positive(),
  currency: z.string().default("USD"),
  country: z.string().min(1),
  region: z.string().min(1),
  gps_lat: z.number(),
  gps_lng: z.number(),
  harvest_date: z.string().optional(),
  quality_grade: z.enum(["A", "B", "C", "Ungraded"]).default("Ungraded"),
  images: z.array(z.string()).optional(),
  farm_id: z.string().uuid().optional(),
})

// GET /api/products — public listing with filters
router.get("/products", optionalAuth, async (req, res) => {
  try {
    const { category, country, min_price, max_price, quality, search, sort, page = "1", limit = "20" } = req.query
    const supabase = createServiceClient()

    let query = supabase
      .from("products")
      .select("*, profiles!products_farmer_id_fkey(full_name, avatar_url, country, region)", { count: "exact" })
      .eq("status", "active")

    if (category) query = query.eq("category", category as string)
    if (country) query = query.eq("country", country as string)
    if (min_price) query = query.gte("price", Number(min_price))
    if (max_price) query = query.lte("price", Number(max_price))
    if (quality) query = query.eq("quality_grade", quality as string)
    if (search) query = query.ilike("name", `%${search}%`)

    // Sorting
    if (sort === "price_asc") query = query.order("price", { ascending: true })
    else if (sort === "price_desc") query = query.order("price", { ascending: false })
    else query = query.order("created_at", { ascending: false })

    // Pagination
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(50, Math.max(1, Number(limit)))
    const offset = (pageNum - 1) * limitNum
    query = query.range(offset, offset + limitNum - 1)

    const { data, error, count } = await query

    if (error) return res.status(400).json({ error: error.message })

    res.json({
      success: true,
      products: data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        pages: Math.ceil((count || 0) / limitNum),
      },
    })
  } catch (err) {
    console.error("[products/list]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/products/my — farmer's own products
router.get("/products/my", requireAuth, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("farmer_id", req.user!.id)
      .order("created_at", { ascending: false })

    if (error) return res.status(400).json({ error: error.message })
    res.json({ success: true, products: data })
  } catch (err) {
    console.error("[products/my]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/products/:id
router.get("/products/:id", optionalAuth, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("products")
      .select("*, profiles!products_farmer_id_fkey(id, full_name, avatar_url, country, region, phone)")
      .eq("id", req.params.id)
      .single()

    if (error || !data) return res.status(404).json({ error: "Product not found" })
    res.json({ success: true, product: data })
  } catch (err) {
    console.error("[products/get]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/products
router.post("/products", requireAuth, async (req, res) => {
  try {
    const body = productSchema.parse(req.body)
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("products")
      .insert({
        ...body,
        farmer_id: req.user!.id,
        status: "active",
      })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json({ success: true, product: data })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[products/create]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PUT /api/products/:id
router.put("/products/:id", requireAuth, async (req, res) => {
  try {
    const body = productSchema.partial().parse(req.body)
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("products")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("farmer_id", req.user!.id)
      .select()
      .single()

    if (error || !data) return res.status(404).json({ error: "Product not found" })
    res.json({ success: true, product: data })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[products/update]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// DELETE /api/products/:id
router.delete("/products/:id", requireAuth, async (req, res) => {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", req.params.id)
      .eq("farmer_id", req.user!.id)

    if (error) return res.status(400).json({ error: error.message })
    res.json({ success: true })
  } catch (err) {
    console.error("[products/delete]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
