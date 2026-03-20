import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { oj, problemId, language, code } = req.body

  if (!oj || !problemId || !language || !code) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  // TODO: proxy submission to OJ
  res.json({
    submissionId: `mock-${Date.now()}`,
    status: 'pending',
    message: `Submission to ${oj} not yet implemented`,
  })
}
