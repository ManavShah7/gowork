import express from 'express'
import { processQueue } from './processor.js'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8080

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'gowork-autopilot' })
})

// Manual trigger
app.post('/process', async (req, res) => {
  try {
    const result = await processQueue()
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Supabase webhook — fires when new job added to apply_queue
app.post('/webhook/queue', async (req, res) => {
  res.json({ received: true })
  // Process immediately
  processQueue().catch(console.error)
})

// Cron endpoint — called every 5 minutes
app.get('/cron', async (req, res) => {
  try {
    const result = await processQueue()
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`GoWork Autopilot running on port ${PORT}`)
})

// Also run on startup
processQueue().catch(console.error)