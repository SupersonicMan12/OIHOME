import { Router } from 'express'

const router = Router()

// POST /api/submit
// body: { oj, problemId, language, code }
router.post('/', async (req, res) => {
  const { oj, problemId, language, code } = req.body

  if (!oj || !problemId || !language || !code) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  // TODO: proxy submission to OJ, return submission ID
  res.json({
    submissionId: `mock-${Date.now()}`,
    status: 'pending',
    message: `Submission to ${oj} not yet implemented`,
  })
})

// GET /api/submit/:id — poll verdict
router.get('/:id', (req, res) => {
  // TODO: poll OJ for verdict
  res.json({ submissionId: req.params.id, status: 'pending' })
})

export default router
