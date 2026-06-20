import { NextFunction, Request, Response } from "express"

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error("[ERROR]", err?.message || err)

  const status = err?.status || err?.statusCode || 500
  const message = err?.message || "Internal server error"

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === "development" ? { stack: err?.stack } : {}),
  })
}
