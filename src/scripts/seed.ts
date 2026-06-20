import "dotenv/config"
import { createServiceClient } from "../config/supabase"

async function main() {
  const supabase = createServiceClient()
  console.log("Seeding database...")

  // Seed price history
  const crops = ["Maize", "Beans", "Rice", "Tomatoes", "Onions", "Potatoes"]
  const countries = ["Kenya", "Uganda", "Tanzania", "Rwanda"]
  const basePrices: Record<string, number> = {
    Maize: 200,
    Beans: 400,
    Rice: 500,
    Tomatoes: 300,
    Onions: 350,
    Potatoes: 180,
  }

  const priceHistoryData = []
  const now = new Date()

  for (let i = 0; i < 12; i++) {
    const recordedAt = new Date(now)
    recordedAt.setMonth(now.getMonth() - i)

    for (const crop of crops) {
      for (const country of countries) {
        // Add random variation to prices
        const base = basePrices[crop]
        const variation = (Math.random() - 0.5) * base * 0.15
        const finalPrice = Math.round((base + variation) * 100) / 100

        priceHistoryData.push({
          product_name: crop,
          category: crop === "Tomatoes" || crop === "Onions" || crop === "Potatoes" ? "Vegetables" : "Grains",
          country,
          region: country === "Kenya" ? "Nairobi" : country === "Uganda" ? "Kampala" : country === "Tanzania" ? "Dodoma" : "Kigali",
          price: finalPrice,
          unit: "ton",
          currency: "USD",
          recorded_at: recordedAt.toISOString(),
        })
      }
    }
  }

  console.log(`Inserting ${priceHistoryData.length} price history entries...`)
  const { error: priceHistoryError } = await supabase
    .from("price_history")
    .insert(priceHistoryData)

  if (priceHistoryError) {
    console.error("Error seeding price history:", priceHistoryError)
  } else {
    console.log("Price history seeded successfully!")
  }

  console.log("Seeding complete.")
}

main().catch(console.error)
