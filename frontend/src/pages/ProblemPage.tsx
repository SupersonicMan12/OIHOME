import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import './ProblemPage.css'

const LANGUAGES = ['C++', 'Python', 'Java', 'JavaScript']
const CREDS_KEY = 'cf_credentials'

// Extracts cookies + Codeforces.csrf from the CF page and sends both to /auth/cf
const BOOKMARKLET_HREF =
  "javascript:(function(){var csrf='';try{csrf=Codeforces.csrf||'';}catch(e){}var w=400,h=300,l=Math.round(screen.width/2-w/2),t=Math.round(screen.height/2-h/2);window.open('https://oihome.vercel.app/auth/cf#c='+encodeURIComponent(document.cookie)+'&csrf='+encodeURIComponent(csrf),'_blank','width='+w+',height='+h+',left='+l+',top='+t+',toolbar=0,menubar=0,scrollbars=0');})();"

interface ProblemData {
  title: string
  timeLimit: string
  memoryLimit: string
  statementHtml: string
  url: string
}

interface VerdictData {
  verdict: string
  passedTestCount?: number
  timeConsumedMillis?: number
  memoryConsumedBytes?: number
}

interface Creds {
  handle: string
  sessionCookie: string
  csrfToken: string
}

declare global {
  interface Window { MathJax?: { typesetPromise: (els: HTMLElement[]) => Promise<void> } }
}

function loadCreds(): Creds {
  try { return JSON.parse(localStorage.getItem(CREDS_KEY) ?? '{}') }
  catch { return { handle: '', sessionCookie: '', csrfToken: '' } }
}

function saveCreds(handle: string, sessionCookie: string, csrfToken = '') {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ handle, sessionCookie, csrfToken }))
}

function verdictClass(v: string) {
  if (v === 'OK') return 'ac'
  if (v === 'TESTING' || v === 'SUBMITTING') return 'judging'
  if (v === 'WRONG_ANSWER') return 'wa'
  if (v === 'TIME_LIMIT_EXCEEDED' || v === 'MEMORY_LIMIT_EXCEEDED') return 'tle'
  if (v === 'RUNTIME_ERROR') return 're'
  if (v === 'COMPILATION_ERROR') return 'ce'
  return 'wa'
}

function verdictLabel(v: string) {
  return ({
    OK: 'Accepted',
    WRONG_ANSWER: 'Wrong Answer',
    TIME_LIMIT_EXCEEDED: 'Time Limit Exceeded',
    MEMORY_LIMIT_EXCEEDED: 'Memory Limit Exceeded',
    RUNTIME_ERROR: 'Runtime Error',
    COMPILATION_ERROR: 'Compilation Error',
    TESTING: 'Judging…',
    SUBMITTING: 'Submitting…',
    FAILED: 'Failed',
    PARTIAL: 'Partial',
  } as Record<string, string>)[v] ?? v
}

export default function ProblemPage() {
  const { oj, contestId, index } = useParams()
  const [searchParams] = useSearchParams()
  const rating = searchParams.get('rating')

  const [problem, setProblem] = useState<ProblemData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [language, setLanguage] = useState('C++')
  const [code, setCode] = useState(DEFAULT_CODE['C++'])

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [creds, setCreds] = useState<Creds>(loadCreds)

  // Wizard state
  const [showModal, setShowModal] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardHandle, setWizardHandle] = useState('')
  const [wizardConnected, setWizardConnected] = useState(false)
  const cfPopupRef = useRef<Window | null>(null)

  const statementRef = useRef<HTMLDivElement>(null)

  // Load problem
  useEffect(() => {
    if (!oj || !contestId || !index) return
    setLoading(true)
    setError(null)
    fetch(`/api/problems/${oj}/${contestId}/${index}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setProblem(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [oj, contestId, index])

  // MathJax
  useEffect(() => {
    if (problem && statementRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([statementRef.current])
    }
  }, [problem])

  // Cleanup polling
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const pollVerdict = useCallback((submissionId: number, handle: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/submit/${submissionId}?handle=${encodeURIComponent(handle)}&contestId=${contestId}`
        )
        const data: VerdictData = await res.json()
        setVerdictData(data)
        if (data.verdict !== 'TESTING' && data.verdict !== 'SUBMITTING') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setSubmitting(false)
        }
      } catch {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setSubmitting(false)
      }
    }, 2000)
  }, [contestId])

  const doSubmit = useCallback(async (handle: string, sessionCookie: string, csrfToken: string) => {
    setSubmitting(true)
    setSubmitError(null)
    setVerdictData({ verdict: 'SUBMITTING' })
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oj, contestId, index, language, code, handle, sessionCookie, csrfToken }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setSubmitError(data.error ?? 'Submission failed')
        setVerdictData(null)
        setSubmitting(false)
        return
      }
      if (!data.submissionId) {
        setVerdictData({ verdict: 'TESTING' })
        setSubmitting(false)
        return
      }
      setVerdictData({ verdict: data.verdict ?? 'TESTING' })
      if (!data.verdict || data.verdict === 'TESTING') {
        pollVerdict(data.submissionId, handle)
      } else {
        setSubmitting(false)
      }
    } catch {
      setSubmitError('Network error — could not reach submission API')
      setVerdictData(null)
      setSubmitting(false)
    }
  }, [oj, contestId, index, language, code, pollVerdict])

  // Listen for auth callback via BroadcastChannel
  // (window.opener in /auth/cf is the CF popup, not this page — postMessage won't work)
  useEffect(() => {
    if (!showModal) return
    const bc = new BroadcastChannel('cf_auth')
    bc.onmessage = (e) => {
      if (e.data?.type !== 'cf_auth_success') return
      bc.close()
      try { cfPopupRef.current?.close() } catch {}
      const fresh = loadCreds()
      setCreds(fresh)
      setWizardConnected(true)
      setTimeout(() => {
        setShowModal(false)
        setWizardConnected(false)
        setWizardStep(1)
        const c = loadCreds()
        doSubmit(c.handle, c.sessionCookie, c.csrfToken)
      }, 1500)
    }
    return () => bc.close()
  }, [showModal, doSubmit])

  const handleSubmit = () => {
    if (!creds.handle || !creds.sessionCookie || !creds.csrfToken) {
      setWizardHandle(creds.handle ?? '')
      // If handle+cookie exist but csrfToken missing, jump straight to step 3 to re-run bookmarklet
      setWizardStep(!creds.handle ? 1 : !creds.sessionCookie ? 2 : 3)
      setShowModal(true)
      return
    }
    doSubmit(creds.handle, creds.sessionCookie, creds.csrfToken)
  }

  const closeModal = () => { setShowModal(false); setWizardStep(1) }

  return (
    <div className="problem-page">

      {/* ── Auth Wizard Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="cred-modal" onClick={e => e.stopPropagation()}>

            {wizardConnected ? (
              <div className="wizard-success">
                <div className="wizard-check">✓</div>
                <p className="wizard-success-title">Connected as {creds.handle}</p>
                <p className="wizard-success-sub">Submitting your code…</p>
              </div>
            ) : (
              <>
                <div className="wizard-header">
                  <h3>Connect Codeforces</h3>
                  <div className="wizard-step-dots">
                    {[1, 2, 3].map(n => (
                      <div key={n} className={`wizard-dot ${wizardStep >= n ? 'active' : ''}`} />
                    ))}
                  </div>
                  <button className="wizard-close" onClick={closeModal}>✕</button>
                </div>

                {/* Step 1: Handle */}
                {wizardStep === 1 && (
                  <div className="wizard-body">
                    <p className="wizard-step-label">Step 1 of 3 — Your Codeforces handle</p>
                    <input
                      className="cred-input"
                      placeholder="e.g. tourist"
                      value={wizardHandle}
                      autoFocus
                      onChange={e => setWizardHandle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && wizardHandle.trim()) {
                          const h = wizardHandle.trim()
                          saveCreds(h, loadCreds().sessionCookie ?? '', loadCreds().csrfToken ?? '')
                          setCreds(c => ({ ...c, handle: h }))
                          setWizardStep(2)
                        }
                      }}
                    />
                    <button
                      className="cred-save-btn"
                      disabled={!wizardHandle.trim()}
                      onClick={() => {
                        const h = wizardHandle.trim()
                        saveCreds(h, loadCreds().sessionCookie ?? '', loadCreds().csrfToken ?? '')
                        setCreds(c => ({ ...c, handle: h }))
                        setWizardStep(2)
                      }}
                    >Next →</button>
                  </div>
                )}

                {/* Step 2: Bookmarklet */}
                {wizardStep === 2 && (
                  <div className="wizard-body">
                    <p className="wizard-step-label">Step 2 of 3 — Add the bookmarklet</p>
                    <p className="wizard-hint">
                      Drag the button below to your bookmarks bar.
                      {' '}(Show it with <kbd>Ctrl+Shift+B</kbd> / <kbd>⌘+Shift+B</kbd>)
                    </p>
                    <div className="wizard-bm-row">
                      {/* eslint-disable-next-line react/jsx-no-target-blank */}
                      <a
                        className="bm-drag-btn"
                        href={BOOKMARKLET_HREF}
                        onClick={e => e.preventDefault()}
                        draggable
                      >
                        ⚡ Connect OIHOME
                      </a>
                      <span className="wizard-hint">← drag to bookmarks bar</span>
                    </div>
                    <button className="cred-save-btn" onClick={() => setWizardStep(3)}>
                      Done, next →
                    </button>
                    <button className="wizard-back" onClick={() => setWizardStep(1)}>← Back</button>
                  </div>
                )}

                {/* Step 3: Open CF and click bookmarklet */}
                {wizardStep === 3 && (
                  <div className="wizard-body">
                    <p className="wizard-step-label">Step 3 of 3 — Authorize</p>
                    <p className="wizard-hint">
                      Click below to open Codeforces. Once it loads, click the{' '}
                      <strong>⚡ Connect OIHOME</strong> bookmarklet.
                      The window will close and your code will submit automatically.
                    </p>
                    <button
                      className="cred-save-btn"
                      onClick={() => {
                        const w = 520, h = 420
                        const l = Math.round(screen.width / 2 - w / 2)
                        const t = Math.round(screen.height / 2 - h / 2)
                        cfPopupRef.current = window.open(
                          'https://codeforces.com',
                          'cf_auth',
                          `width=${w},height=${h},left=${l},top=${t},toolbar=0,menubar=0,scrollbars=1`
                        )
                      }}
                    >
                      Open Codeforces ↗
                    </button>
                    <p className="wizard-waiting">
                      Waiting for connection<span className="wizard-dots-anim" />
                    </p>
                    <button className="wizard-back" onClick={() => setWizardStep(2)}>← Back</button>

                    <details className="wizard-manual">
                      <summary>Trouble with the bookmarklet? Paste cookies manually</summary>
                      <p className="wizard-hint" style={{ marginTop: 8 }}>
                        On <a href="https://codeforces.com" target="_blank" rel="noreferrer">codeforces.com</a>,
                        open DevTools → Application → Cookies → codeforces.com.
                        Copy all as <code>name=value; name2=value2</code> and paste below.
                      </p>
                      <textarea
                        className="cred-input cred-textarea"
                        placeholder="JSESSIONID=abc123; X-Csrf-Token=..."
                        rows={3}
                        onChange={e => {
                          const cookie = e.target.value.trim()
                          if (!cookie) return
                          saveCreds(loadCreds().handle ?? '', cookie, loadCreds().csrfToken ?? '')
                          setCreds(c => ({ ...c, sessionCookie: cookie }))
                          setWizardConnected(true)
                          setTimeout(() => {
                            setShowModal(false)
                            setWizardConnected(false)
                            setWizardStep(1)
                            const fresh = loadCreds()
                            doSubmit(fresh.handle, fresh.sessionCookie, fresh.csrfToken)
                          }, 1500)
                        }}
                      />
                    </details>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Problem panel ────────────────────────────────────────────────── */}
      <div className="problem-panel">
        {loading && <div className="loading">Loading problem…</div>}
        {error && <div className="error-msg">{error}</div>}
        {problem && (
          <>
            <div className="problem-header">
              <h2>{problem.title}</h2>
              <div className="problem-header-right">
                {rating && <span className="rating-badge">{rating}</span>}
                <span className={`oj-badge oj-${oj}`}>{oj}</span>
                <a href={problem.url} target="_blank" rel="noreferrer" className="cf-link">↗ CF</a>
              </div>
            </div>
            <div className="problem-meta">
              <span>⏱ {problem.timeLimit}</span>
              <span>💾 {problem.memoryLimit}</span>
            </div>
            <div
              ref={statementRef}
              className="problem-statement-html"
              dangerouslySetInnerHTML={{ __html: problem.statementHtml }}
            />
          </>
        )}
      </div>

      {/* ── Editor panel ─────────────────────────────────────────────────── */}
      <div className="editor-panel">
        <div className="editor-toolbar">
          <select
            className="lang-select"
            value={language}
            onChange={e => { setLanguage(e.target.value); setCode(DEFAULT_CODE[e.target.value] ?? '') }}
          >
            {LANGUAGES.map(l => <option key={l}>{l}</option>)}
          </select>
          <div className="toolbar-right">
            <button
              className={`account-btn ${creds.handle && creds.sessionCookie && creds.csrfToken ? 'logged-in' : ''}`}
              onClick={() => {
                setWizardHandle(creds.handle ?? '')
                setWizardStep(creds.handle ? (creds.sessionCookie ? 3 : 2) : 1)
                setShowModal(true)
              }}
              title={creds.handle ? `Connected as ${creds.handle} — click to reconnect` : 'Connect Codeforces account'}
            >
              {creds.handle && creds.sessionCookie && creds.csrfToken ? `⚡ ${creds.handle}` : '⚙ Connect CF'}
            </button>
            <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>

        <Editor
          height="calc(100vh - 200px)"
          language={LANG_MAP[language]}
          value={code}
          onChange={v => setCode(v ?? '')}
          theme="vs-dark"
          options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on' }}
        />

        {submitError && <div className="submit-error">{submitError}</div>}
        {verdictData && (
          <div className={`verdict ${verdictClass(verdictData.verdict)}`}>
            <span className="verdict-label">{verdictLabel(verdictData.verdict)}</span>
            {verdictData.verdict === 'OK' && verdictData.timeConsumedMillis != null && (
              <span className="verdict-meta">
                {verdictData.timeConsumedMillis} ms · {Math.round((verdictData.memoryConsumedBytes ?? 0) / 1024)} KB
              </span>
            )}
            {verdictData.verdict === 'WRONG_ANSWER' && verdictData.passedTestCount != null && (
              <span className="verdict-meta">on test {(verdictData.passedTestCount ?? 0) + 1}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const LANG_MAP: Record<string, string> = {
  'C++': 'cpp', 'Python': 'python', 'Java': 'java', 'JavaScript': 'javascript',
}

const DEFAULT_CODE: Record<string, string> = {
  'C++': `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // your code here

    return 0;
}`,
  'Python': `import sys
input = sys.stdin.readline

# your code here
`,
  'Java': `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // your code here
    }
}`,
  'JavaScript': `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');
let idx = 0;

// your code here
`,
}
