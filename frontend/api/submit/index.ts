import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parse } from 'node-html-parser'

// Codeforces programTypeId values
const CF_LANG_IDS: Record<string, number> = {
  'C++': 54,        // C++17 (GCC 7-32)
  'Python': 31,     // Python 3
  'Java': 60,       // Java 11
  'JavaScript': 34, // JavaScript (V8)
}

function extractSetCookies(headers: Headers): string[] {
  if (typeof (headers as any).getSetCookie === 'function') {
    return (headers as any).getSetCookie() as string[]
  }
  const raw = headers.get('set-cookie')
  if (!raw) return []
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

// Parse a raw cookie string (e.g. from browser DevTools) into a map
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

async function extractCsrf(html: string): Promise<string> {
  // Try inline JS first — most reliable on CF
  const jsMatch = html.match(/Codeforces\.csrf\s*=\s*'([a-f0-9]+)'/)
  if (jsMatch) return jsMatch[1]

  const root = parse(html)
  const input = root.querySelector('input[name="csrf_token"]')
  if (input?.getAttribute('value')) return input.getAttribute('value')!
  const meta = root.querySelector('meta[name="X-Csrf-Token"]')
  if (meta?.getAttribute('content')) return meta.getAttribute('content')!

  return ''
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

  const { oj, contestId, index, language, code, handle, sessionCookie } = req.body

  const missing = ['contestId', 'index', 'language', 'code', 'handle', 'sessionCookie']
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
    // ── Step 1: Fetch submit page using the user's session cookie ────────────
    // Since the user is already logged into CF in their browser, their session
    // cookies bypass Cloudflare challenges. We never touch the login form.
    const submitUrl = `https://codeforces.com/contest/${contestId}/submit`
    let cookies = parseRawCookieString(sessionCookie)

    const submitPageRes = await fetch(submitUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Cookie: serializeCookies(cookies),
        Referer: 'https://codeforces.com/',
      },
    })

    const submitPageHtml = await submitPageRes.text()
    cookies = mergeCookieMaps(cookies, parseCookieHeaders(extractSetCookies(submitPageRes.headers)))

    // Check if we're logged in (CF redirects to login page if not)
    if (submitPageHtml.includes('handle or email') || submitPageRes.url?.includes('/enter')) {
      res.status(401).json({ error: 'Session expired — please update your CF session cookie in account settings' })
      return
    }

    const submitCsrf = await extractCsrf(submitPageHtml)
    if (!submitCsrf) {
      const preview = submitPageHtml.slice(0, 400).replace(/\s+/g, ' ')
      res.status(502).json({ error: `Could not extract CSRF token from submit page. Preview: ${preview}` })
      return
    }

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
