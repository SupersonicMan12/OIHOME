import { Router } from 'express'

const router = Router()

// GET /api/problems?oj=codeforces&page=1
router.get('/', (_req, res) => {
  // TODO: fetch from DB / scraper
  res.json({ problems: [], total: 0 })
})

// GET /api/problems/:oj/:id
router.get('/:oj/:id', (req, res) => {
  const { oj, id } = req.params
  // TODO: fetch problem from cache or scrape
  res.json({ oj, id, title: 'Coming soon', statement: '' })
})

export default router
