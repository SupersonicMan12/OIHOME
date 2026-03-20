import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  // TODO: fetch from DB / scraper
  res.json({ problems: [], total: 0 })
}
