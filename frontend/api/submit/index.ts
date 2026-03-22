import type { VercelRequest, VercelResponse } from '@vercel/node'

// GET /api/submit/latest?handle=X&contestId=Y
// Returns the most recent submission for the user in that contest.
// The actual POST to CF is done client-side (browser credentials: 'include'),
// bypassing Cloudflare. This endpoint just reads the public CF API for the result.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { handle, contestId } = req.query
  if (!handle || !contestId) {
    res.status(400).json({ error: 'Missing handle or contestId' })
    return
  }

  try {
    const cfRes = await fetch(
      `https://codeforces.com/api/contest.status?contestId=${contestId}&handle=${handle}&count=1`
    )
    const data = await cfRes.json() as { status: string; result?: any[] }

    if (data.status !== 'OK' || !data.result?.length) {
      res.json({ submissionId: null })
      return
    }

    const sub = data.result[0]
    res.json({
      submissionId: sub.id,
      verdict: sub.verdict ?? 'TESTING',
      passedTestCount: sub.passedTestCount ?? 0,
      timeConsumedMillis: sub.timeConsumedMillis ?? 0,
      memoryConsumedBytes: sub.memoryConsumedBytes ?? 0,
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch submission status' })
  }
}
