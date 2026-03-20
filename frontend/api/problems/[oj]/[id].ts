import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { oj, id } = req.query
  // TODO: fetch problem from cache or scraper
  res.json({ oj, id, title: 'Coming soon', statement: '' })
}
