import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import './ProblemPage.css'

const LANGUAGES = ['C++', 'Python', 'Java', 'JavaScript']

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

declare global {
  interface Window { MathJax?: { typesetPromise: (els: HTMLElement[]) => Promise<void> } }
}

const CREDS_KEY = 'cf_credentials'

function loadCreds(): { handle: string; sessionCookie: string } {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY) ?? '{}')
  } catch {
    return { handle: '', sessionCookie: '' }
  }
}

function saveCreds(handle: string, sessionCookie: string) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ handle, sessionCookie }))
}

function verdictClass(v: string): string {
  if (v === 'OK') return 'ac'
  if (v === 'TESTING' || v === 'SUBMITTING') return 'judging'
  if (v === 'WRONG_ANSWER') return 'wa'
  if (v === 'TIME_LIMIT_EXCEEDED') return 'tle'
  if (v === 'MEMORY_LIMIT_EXCEEDED') return 'mle'
  if (v === 'RUNTIME_ERROR') return 're'
  if (v === 'COMPILATION_ERROR') return 'ce'
  return 'wa'
}

function verdictLabel(v: string): string {
  const map: Record<string, string> = {
    OK: 'Accepted',
    WRONG_ANSWER: 'Wrong Answer',
    TIME_LIMIT_EXCEEDED: 'Time Limit Exceeded',
    MEMORY_LIMIT_EXCEEDED: 'Memory Limit Exceeded',
    RUNTIME_ERROR: 'Runtime Error',
    COMPILATION_ERROR: 'Compilation Error',
    TESTING: 'Judging...',
    SUBMITTING: 'Submitting...',
    FAILED: 'Failed',
    PARTIAL: 'Partial',
    IDLENESS_LIMIT_EXCEEDED: 'Idleness Limit Exceeded',
  }
  return map[v] ?? v
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

  // Credentials
  const [creds, setCreds] = useState(loadCreds)
  const [showCredModal, setShowCredModal] = useState(false)
  const [credInput, setCredInput] = useState({ handle: '', sessionCookie: '' })

  const statementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!oj || !contestId || !index) return
    setLoading(true)
    setError(null)
    fetch(`/api/problems/${oj}/${contestId}/${index}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setProblem(data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [oj, contestId, index])

  useEffect(() => {
    if (problem && statementRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([statementRef.current])
    }
  }, [problem])

  // Clear polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const pollVerdict = useCallback((submissionId: number) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/submit/${submissionId}?handle=${encodeURIComponent(creds.handle)}&contestId=${contestId}`
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
  }, [creds.handle, contestId])

  const handleSubmit = async () => {
    if (!creds.handle || !creds.sessionCookie) {
      setCredInput({ handle: creds.handle ?? '', sessionCookie: creds.sessionCookie ?? '' })
      setShowCredModal(true)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    setVerdictData({ verdict: 'SUBMITTING' })

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oj, contestId, index, language, code, handle: creds.handle, sessionCookie: creds.sessionCookie }),
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
      if (data.verdict === 'TESTING' || !data.verdict) {
        pollVerdict(data.submissionId)
      } else {
        setSubmitting(false)
      }
    } catch {
      setSubmitError('Network error — could not reach submission API')
      setVerdictData(null)
      setSubmitting(false)
    }
  }

  const handleSaveCreds = () => {
    saveCreds(credInput.handle, credInput.sessionCookie)
    setCreds({ handle: credInput.handle, sessionCookie: credInput.sessionCookie })
    setShowCredModal(false)
  }

  return (
    <div className="problem-page">
      {/* Credentials modal */}
      {showCredModal && (
        <div className="modal-overlay" onClick={() => setShowCredModal(false)}>
          <div className="cred-modal" onClick={e => e.stopPropagation()}>
            <h3>Codeforces Account</h3>
            <label>Handle</label>
            <input
              className="cred-input"
              placeholder="your_handle"
              value={credInput.handle}
              onChange={e => setCredInput(c => ({ ...c, handle: e.target.value }))}
              autoFocus
            />
            <label>Session Cookie</label>
            <textarea
              className="cred-input cred-textarea"
              placeholder="JSESSIONID=abc123; X-Csrf-Token=..."
              value={credInput.sessionCookie}
              onChange={e => setCredInput(c => ({ ...c, sessionCookie: e.target.value }))}
              rows={3}
            />
            <p className="cred-hint">
              Log into <a href="https://codeforces.com" target="_blank" rel="noreferrer">codeforces.com</a> in your browser,
              then open DevTools (F12) → Application → Cookies → codeforces.com.
              Copy all cookie values as <code>name=value; name2=value2</code> and paste above.
              Stored locally in your browser only.
            </p>
            <div className="cred-modal-btns">
              <button className="cred-save-btn" onClick={handleSaveCreds}>Save & Submit</button>
              <button className="cred-cancel-btn" onClick={() => setShowCredModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="problem-panel">
        {loading && <div className="loading">Loading problem...</div>}
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

      <div className="editor-panel">
        <div className="editor-toolbar">
          <select
            className="lang-select"
            value={language}
            onChange={e => {
              setLanguage(e.target.value)
              setCode(DEFAULT_CODE[e.target.value] ?? '')
            }}
          >
            {LANGUAGES.map(l => <option key={l}>{l}</option>)}
          </select>
          <div className="toolbar-right">
            <button
              className={`account-btn ${creds.handle ? 'logged-in' : ''}`}
              onClick={() => {
                setCredInput({ handle: creds.handle ?? '', sessionCookie: creds.sessionCookie ?? '' })
                setShowCredModal(true)
              }}
              title={creds.handle ? `Logged in as ${creds.handle}` : 'Set Codeforces account'}
            >
              {creds.handle ? `⚡ ${creds.handle}` : '⚙ CF Account'}
            </button>
            <button className="submit-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
        <Editor
          height="calc(100vh - 200px)"
          language={LANG_MAP[language]}
          value={code}
          onChange={v => setCode(v ?? '')}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
          }}
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
  'C++': 'cpp',
  'Python': 'python',
  'Java': 'java',
  'JavaScript': 'javascript',
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
