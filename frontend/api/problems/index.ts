import type { VercelRequest, VercelResponse } from '@vercel/node'

const CF_API = 'https://codeforces.com/api/problemset.problems'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { oj = 'codeforces', page = '1', limit = '50', tag, search } = req.query

  if (oj !== 'codeforces') {
    res.json({ problems: [], total: 0 })
    return
  }

  try {
    const cfRes = await fetch(CF_API)
    const data = await cfRes.json() as CFResponse

    if (data.status !== 'OK') {
      res.status(502).json({ error: 'Codeforces API error' })
      return
    }

    const statsMap = new Map(
      data.result.problemStatistics.map(s => [`${s.contestId}-${s.index}`, s.solvedCount])
    )

    let problems = data.result.problems.map(p => ({
      id: `${p.contestId}${p.index}`,
      contestId: p.contestId,
      index: p.index,
      oj: 'codeforces',
      ojLabel: 'Codeforces',
      title: p.name,
      difficulty: p.rating ?? null,
      tags: p.tags,
      solvedCount: statsMap.get(`${p.contestId}-${p.index}`) ?? 0,
      url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
    }))

    // filter by tag
    if (tag && typeof tag === 'string') {
      problems = problems.filter(p => p.tags.includes(tag))
    }

    // filter by search
    if (search && typeof search === 'string') {
      const q = search.toLowerCase()
      problems = problems.filter(p => p.title.toLowerCase().includes(q))
    }

    const total = problems.length
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const start = (pageNum - 1) * limitNum
    const paged = problems.slice(start, start + limitNum)

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.json({ problems: paged, total, page: pageNum, limit: limitNum })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch problems' })
  }
}

interface CFProblem {
  contestId: number
  index: string
  name: string
  rating?: number
  tags: string[]
}

interface CFStat {
  contestId: number
  index: string
  solvedCount: number
}

interface CFResponse {
  status: string
  result: {
    problems: CFProblem[]
    problemStatistics: CFStat[]
  }
}
