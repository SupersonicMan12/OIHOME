import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parse } from 'node-html-parser' // used for error message extraction only

const CF_LANG_IDS: Record<string, number> = {
  'C++': 54,        // C++17 (GCC 7-32)
  'Python': 31,     // Python 3
  'Java': 60,       // Java 11
  'JavaScript': 34, // JavaScript (V8)
}

function serializeCookies(map: Record<string, string>): string {
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ')
}

function parseRawCookieString(raw: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0) {
      const k = part.slice(0, eq).trim()
      const v = part.slice(eq + 1).trim()
      if (k) map[k] = v
    }
  }
  return map
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { oj, contestId, index, language, code, handle, sessionCookie, csrfToken } = req.body

  const missing = ['contestId', 'index', 'language', 'code', 'handle', 'sessionCookie', 'csrfToken']
    .filter(f => !(req.body as any)[f])
  if (missing.length) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
    return
  }

  if (oj !== 'codeforces') {
    res.status(400).json({ error: 'Only Codeforces submissions are supported' })
    return
  }

  const langId = CF_LANG_IDS[language]
  if (!langId) {
    res.status(400).json({ error: `Unsupported language: ${language}` })
    return
  }

  try {
    const submitUrl = `https://codeforces.com/contest/${contestId}/submit`
    const cookies = parseRawCookieString(sessionCookie)
    // csrfToken is extracted from Codeforces.csrf by the bookmarklet at auth time
    const submitCsrf = csrfToken

    // ── Step 2: POST submission ───────────────────────────────────────────────
    const submitBody = new URLSearchParams({
      csrf_token: submitCsrf,
      action: 'submitSolutionFormSubmitted',
      submittedProblemIndex: index,
      programTypeId: String(langId),
      contestId: String(contestId),
      source: code,
      tabSize: '4',
      sourceFile: '',
    })

    const submitRes = await fetch(`${submitUrl}?csrf_token=${submitCsrf}`, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: serializeCookies(cookies),
        Referer: submitUrl,
      },
      body: submitBody.toString(),
      redirect: 'manual',
    })

    if (submitRes.status !== 302) {
      const html = await submitRes.text()
      const root = parse(html)
      const errEl = root.querySelector('.error, [class*="error"]')
      const errMsg = errEl?.innerText.trim()
      res.status(502).json({ error: errMsg ?? 'Submission failed — CF did not redirect after submit' })
      return
    }

    // ── Step 3: Fetch latest submission ID via CF API ─────────────────────────
    await new Promise(r => setTimeout(r, 1500))
    const statusRes = await fetch(
      `https://codeforces.com/api/contest.status?contestId=${contestId}&handle=${handle}&count=1`
    )
    const statusData = await statusRes.json() as { status: string; result?: any[] }

    if (statusData.status !== 'OK' || !statusData.result?.length) {
      res.json({ submissionId: null, verdict: 'TESTING', message: 'Submitted — could not retrieve submission ID' })
      return
    }

    const sub = statusData.result[0]
    res.json({ submissionId: sub.id, verdict: sub.verdict ?? 'TESTING' })
  } catch (err) {
    console.error('Submit error:', err)
    res.status(500).json({ error: 'Internal submission error' })
  }
}
