import { Router } from "express"
import { createServiceClient, createSupabaseClient } from "../config/supabase"
import { z } from "zod"

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  role: z.enum(["farmer", "buyer", "transporter", "vendor", "warehouse_owner"]),
  country: z.string().default("Kenya"),
  region: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  try {
    const body = registerSchema.parse(req.body)
    const supabase = createServiceClient()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || "Failed to create user" })
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email: body.email,
      full_name: body.full_name,
      phone: body.phone || null,
      role: body.role,
      country: body.country,
      region: body.region || null,
    })

    if (profileError) {
      // Cleanup: delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return res.status(400).json({ error: profileError.message })
    }

    // Sign in to get tokens
    const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    if (signInError) {
      return res.status(400).json({ error: signInError.message })
    }

    res.status(201).json({
      success: true,
      user: {
        id: authData.user.id,
        email: body.email,
        full_name: body.full_name,
        role: body.role,
      },
      session: {
        access_token: session.session?.access_token,
        refresh_token: session.session?.refresh_token,
      },
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[auth/register]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body)
    const supabase = createServiceClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    if (error || !data.session) {
      return res.status(401).json({ error: error?.message || "Invalid credentials" })
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single()

    res.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        ...profile,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors })
    }
    console.error("[auth/login]", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/auth/logout
router.post("/auth/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.toString().replace("Bearer ", "")
    if (token) {
      const supabase = createSupabaseClient(token)
      await supabase.auth.signOut()
    }
    res.json({ success: true })
  } catch (err) {
    console.error("[auth/logout]", err)
    res.json({ success: true })
  }
})

export default router
