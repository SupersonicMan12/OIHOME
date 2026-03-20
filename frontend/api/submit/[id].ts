import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  // TODO: poll OJ for verdict
  res.json({ submissionId: id, status: 'pending' })
}
