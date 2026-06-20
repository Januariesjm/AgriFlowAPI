import { NextFunction, Request, Response } from "express"
import { createSupabaseClient } from "../config/supabase"

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string
      email?: string
      role?: string
    }
    accessToken?: string
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.toString().startsWith("Bearer ") ? authHeader.slice(7) : undefined

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const supabase = createSupabaseClient(token)
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid token" })
    }

    req.user = { id: data.user.id, email: data.user.email ?? undefined }
    req.accessToken = token
    next()
  } catch (err) {
    console.error("[auth] error verifying token", err)
    return res.status(401).json({ error: "Unauthorized" })
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.toString().startsWith("Bearer ") ? authHeader.slice(7) : undefined

    if (!token) {
      return next()
    }

    const supabase = createSupabaseClient(token)
    const { data, error } = await supabase.auth.getUser(token)

    if (!error && data.user) {
      req.user = { id: data.user.id, email: data.user.email ?? undefined }
      req.accessToken = token
    }

    next()
  } catch {
    next()
  }
}
