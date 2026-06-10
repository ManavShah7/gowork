import 'dotenv/config'
import express from 'express'
import { processQueue } from './processor.js'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8080

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'gowork-autopilot' })
})

app.post('/process', async (req, res) => {
  try {
    const result = await processQueue()
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('Process error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/webhook/queue', async (req, res) => {
  res.json({ received: true })
  processQueue().catch(console.error)
})

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

processQueue().catch(console.error)