import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import problemsRouter from './routes/problems.js'
import submitRouter from './routes/submit.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/problems', problemsRouter)
app.use('/api/submit', submitRouter)

app.listen(PORT, () => {
  console.log(`OIHOME backend running on port ${PORT}`)
})
