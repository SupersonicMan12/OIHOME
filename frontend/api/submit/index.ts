import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parse } from 'node-html-parser'

// Codeforces programTypeId values
const CF_LANG_IDS: Record<string, number> = {
  'C++': 54,       // C++17 (GCC 7-32)
  'Python': 31,    // Python 3
  'Java': 60,      // Java 11
  'JavaScript': 34, // JavaScript (V8)
}

function extractSetCookies(headers: Headers): string[] {
  // Node 18.14+ has getSetCookie(), fall back to splitting the joined header
  if (typeof (headers as any).getSetCookie === 'function') {
    return (headers as any).getSetCookie() as string[]
  }
  const raw = headers.get('set-cookie')
  if (!raw) return []
  // naive split — works for CF cookies which don't contain commas in values
  return raw.split(/,(?=\s*\w+=)/)
}

function parseCookieHeaders(setCookies: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const header of setCookies) {
    const pair = header.split(';')[0].trim()
    const eq = pair.indexOf('=')
    if (eq > 0) map[pair.slice(0, eq)] = pair.slice(eq + 1)
  }
  return map
}

function serializeCookies(map: Record<string, string>): string {
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ')
}

function mergeCookieMaps(...maps: Record<string, string>[]): Record<string, string> {
  return Object.assign({}, ...maps)
}

async function extractCsrf(html: string): Promise<string> {
  const root = parse(html)
  // Try meta tag first
  const meta = root.querySelector('meta[name="X-Csrf-Token"]')
  if (meta) return meta.getAttribute('content') ?? ''
  // Try hidden input
  const input = root.querySelector('input[name="csrf_token"]')
  if (input) return input.getAttribute('value') ?? ''
  // Try inline JS: Codeforces.csrf = 'xxx'
  const match = html.match(/Codeforces\.csrf\s*=\s*'([^']+)'/)
  return match?.[1] ?? ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { oj, contestId, index, language, code, handle, password } = req.body

  if (!contestId || !index || !language || !code || !handle || !password) {
    res.status(400).json({ error: 'Missing required fields' })
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
    // ── Step 1: Fetch login page → get CSRF token + initial cookies ──────────
    const loginPageRes = await fetch('https://codeforces.com/enter', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const loginPageHtml = await loginPageRes.text()
    const loginCsrf = await extractCsrf(loginPageHtml)
    let cookies = parseCookieHeaders(extractSetCookies(loginPageRes.headers))

    if (!loginCsrf) {
      res.status(502).json({ error: 'Could not extract CSRF token from CF login page' })
      return
    }

    // ── Step 2: POST login ────────────────────────────────────────────────────
    const loginBody = new URLSearchParams({
      handleOrEmail: handle,
      password,
      csrf_token: loginCsrf,
      action: 'enter',
      ftaa: '',
      bfaa: '',
      _tta: '0',
    })
    const loginRes = await fetch('https://codeforces.com/enter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        Cookie: serializeCookies(cookies),
        Referer: 'https://codeforces.com/enter',
      },
      body: loginBody.toString(),
      redirect: 'manual',
    })

    cookies = mergeCookieMaps(cookies, parseCookieHeaders(extractSetCookies(loginRes.headers)))

    const location = loginRes.headers.get('location') ?? ''
    if (loginRes.status !== 302 || location.includes('/enter')) {
      res.status(401).json({ error: 'Login failed — check your Codeforces handle/password' })
      return
    }

    // ── Step 3: Fetch submit page → get CSRF token ───────────────────────────
    const submitUrl = `https://codeforces.com/contest/${contestId}/submit`
    const submitPageRes = await fetch(submitUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Cookie: serializeCookies(cookies),
      },
    })
    const submitPageHtml = await submitPageRes.text()
    const submitCsrf = await extractCsrf(submitPageHtml)
    cookies = mergeCookieMaps(cookies, parseCookieHeaders(extractSetCookies(submitPageRes.headers)))

    if (!submitCsrf) {
      res.status(502).json({ error: 'Could not extract CSRF token from submit page' })
      return
    }

    // ── Step 4: POST submission ───────────────────────────────────────────────
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
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
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

    // ── Step 5: Fetch latest submission ID ───────────────────────────────────
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
