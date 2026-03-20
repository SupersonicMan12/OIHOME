import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parse } from 'node-html-parser'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { oj, contestId, problemIndex } = req.query

  if (oj !== 'codeforces') {
    res.status(404).json({ error: 'OJ not yet supported' })
    return
  }

  try {
    const url = `https://codeforces.com/problemset/problem/${contestId}/${problemIndex}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OIHOME/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!response.ok) {
      res.status(502).json({ error: `CF returned ${response.status}` })
      return
    }

    const html = await response.text()
    const root = parse(html)

    const titleEl = root.querySelector('.title')
    const timeLimitEl = root.querySelector('.time-limit')
    const memoryLimitEl = root.querySelector('.memory-limit')
    const statementEl = root.querySelector('.problem-statement')

    if (!statementEl) {
      res.status(404).json({ error: 'Problem not found' })
      return
    }

    // Remove the header div (title/limits) from the statement — we expose them separately
    statementEl.querySelector('.header')?.remove()

    // Make image URLs absolute
    const statementHtml = statementEl.innerHTML
      .replace(/src="\/predownloaded/g, 'src="https://codeforces.com/predownloaded')
      .replace(/src="\/espresso/g, 'src="https://codeforces.com/espresso')

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    res.json({
      oj: 'codeforces',
      contestId,
      index: problemIndex,
      title: titleEl?.text.trim() ?? `${contestId}${problemIndex}`,
      timeLimit: timeLimitEl?.text.replace('time limit per test', '').trim() ?? '',
      memoryLimit: memoryLimitEl?.text.replace('memory limit per test', '').trim() ?? '',
      statementHtml,
      url,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch problem' })
  }
}
