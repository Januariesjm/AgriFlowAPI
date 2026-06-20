import "dotenv/config"
import express from "express"
import cors from "cors"
import compression from "compression"
import morgan from "morgan"
import router from "./routes"
import { errorHandler } from "./middleware/error"

const app = express()

app.use(compression())
app.use(cors())
app.use(express.json({ limit: "5mb" }))
app.use(morgan(process.env.LOG_LEVEL || "dev"))

app.use("/api", router)

app.use(errorHandler)

const port = Number(process.env.APP_PORT) || Number(process.env.PORT) || 4000

app.listen(port, "0.0.0.0", () => {
  console.log(`AgriFlowAPI listening on http://0.0.0.0:${port}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
})
