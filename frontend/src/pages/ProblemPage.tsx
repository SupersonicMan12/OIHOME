import { useState, useEffect, useRef } from 'react'
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

declare global {
  interface Window { MathJax?: { typesetPromise: (els: HTMLElement[]) => Promise<void> } }
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
  const [verdict, setVerdict] = useState<string | null>(null)

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

  // Trigger MathJax after statement renders
  useEffect(() => {
    if (problem && statementRef.current && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([statementRef.current])
    }
  }, [problem])

  const handleSubmit = async () => {
    setVerdict('Judging...')
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oj, problemId: `${contestId}${index}`, language, code }),
    })
    const data = await res.json()
    setVerdict(data.message ?? 'Submitted')
  }

  return (
    <div className="problem-page">
      <div className="problem-panel">
        {loading && <div className="loading">Loading problem...</div>}
        {error && <div className="error-msg">{error}</div>}
        {problem && (
          <>
            <div className="problem-header">
              <h2>{problem.title}</h2>
              <div className="problem-header-right">
                {rating && <span className={`rating-badge r${Math.floor(parseInt(rating) / 500) * 500}`}>{rating}</span>}
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
          <button className="submit-btn" onClick={handleSubmit}>Submit</button>
        </div>
        <Editor
          height="calc(100vh - 160px)"
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
        {verdict && (
          <div className={`verdict ${verdict === 'Accepted' ? 'ac' : verdict === 'Judging...' ? 'judging' : 'wa'}`}>
            {verdict}
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
