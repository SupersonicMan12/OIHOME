import { useEffect, useState } from 'react'

const CREDS_KEY = 'cf_credentials'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [handle, setHandle] = useState('')

  useEffect(() => {
    const raw = location.hash.slice(1)
    if (!raw) { setStatus('error'); return }

    let cookieStr: string
    try { cookieStr = decodeURIComponent(raw) } catch { setStatus('error'); return }
    if (!cookieStr) { setStatus('error'); return }

    const existing = JSON.parse(localStorage.getItem(CREDS_KEY) ?? '{}')
    localStorage.setItem(CREDS_KEY, JSON.stringify({ ...existing, sessionCookie: cookieStr }))
    setHandle(existing.handle ?? '')
    setStatus('ok')

    if (window.opener) setTimeout(() => window.close(), 1500)
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 16,
      background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {status === 'loading' && <p style={{ color: 'var(--text-muted)' }}>Connecting…</p>}

      {status === 'ok' && (
        <>
          <div style={{ fontSize: 64, lineHeight: 1, color: 'var(--green)' }}>✓</div>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', margin: 0 }}>Connected!</p>
          {handle && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
              Logged in as <strong style={{ color: 'var(--text)' }}>{handle}</strong>
            </p>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
            {window.opener ? 'This window will close automatically…' : 'You can close this tab.'}
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ fontSize: 48 }}>⚠</div>
          <p style={{ color: 'var(--red)', fontSize: 16, fontWeight: 600, margin: 0 }}>No cookies found</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', maxWidth: 300, margin: 0 }}>
            Make sure you clicked the bookmarklet while on codeforces.com and are logged in.
          </p>
        </>
      )}
    </div>
  )
}
