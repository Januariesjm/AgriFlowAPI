import { Router } from "express"
import authRouter from "./auth"
import profileRouter from "./profile"
import farmsRouter from "./farms"
import productsRouter from "./products"
import pricesRouter from "./prices"
import ordersRouter from "./orders"
import transportRouter from "./transport"
import adminRouter from "./admin"

const router = Router()

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "AgriFlowAPI" })
})

router.use(authRouter)
router.use(profileRouter)
router.use(farmsRouter)
router.use(productsRouter)
router.use(pricesRouter)
router.use(ordersRouter)
router.use(transportRouter)
router.use(adminRouter)

export default router
