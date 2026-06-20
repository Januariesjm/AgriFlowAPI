import { NextFunction, Request, Response } from "express"
import { createServiceClient } from "../config/supabase"

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const supabase = createServiceClient()
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single()

    if (error || !profile || profile.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    req.user.role = "admin"
    next()
  } catch (err) {
    console.error("[adminAuth] error", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}
