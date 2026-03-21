import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id, handle, contestId } = req.query

  if (!id || !handle || !contestId) {
    res.status(400).json({ error: 'Missing id, handle, or contestId' })
    return
  }

  try {
    const cfRes = await fetch(
      `https://codeforces.com/api/contest.status?contestId=${contestId}&handle=${handle}&count=10`
    )
    const data = await cfRes.json() as { status: string; result?: any[] }

    if (data.status !== 'OK') {
      res.status(502).json({ error: 'Failed to fetch verdict from Codeforces' })
      return
    }

    const sub = data.result?.find(s => String(s.id) === String(id))
    if (!sub) {
      // Not found yet — still queued
      res.json({ submissionId: id, verdict: 'TESTING', passedTestCount: 0 })
      return
    }

    res.json({
      submissionId: sub.id,
      verdict: sub.verdict ?? 'TESTING',
      passedTestCount: sub.passedTestCount ?? 0,
      timeConsumedMillis: sub.timeConsumedMillis ?? 0,
      memoryConsumedBytes: sub.memoryConsumedBytes ?? 0,
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch verdict' })
  }
}
