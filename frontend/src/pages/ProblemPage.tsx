import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import './ProblemPage.css'

const LANGUAGES = ['C++', 'Python', 'Java', 'JavaScript']

const MOCK_PROBLEM = {
  title: 'Watermelon',
  oj: 'Codeforces',
  timeLimit: '1 second',
  memoryLimit: '256 MB',
  statement: `Pete and Billy found a very large watermelon and want to split it between themselves.

They want to cut it into two non-empty parts so that each part's weight is even. Both boys have equal chances of getting either part.

You are given the weight w of the watermelon. Find if it is possible to cut it so that both parts weigh an even number of pounds.`,
  inputSpec: 'The first (and only) line contains one integer w (1 ≤ w ≤ 100) — the weight of the watermelon.',
  outputSpec: 'Print YES if it is possible to cut the watermelon into two even-weighted parts, and NO otherwise.',
  sampleInput: '8',
  sampleOutput: 'YES',
}

export default function ProblemPage() {
  const { oj, id } = useParams()
  const [language, setLanguage] = useState('C++')
  const [code, setCode] = useState(DEFAULT_CODE['C++'])
  const [verdict, setVerdict] = useState<string | null>(null)

  const handleSubmit = async () => {
    setVerdict('Judging...')
    // TODO: call backend /api/submit
    setTimeout(() => setVerdict('Accepted'), 1500)
  }

  return (
    <div className="problem-page">
      <div className="problem-panel">
        <div className="problem-header">
          <h2>{MOCK_PROBLEM.title}</h2>
          <span className="oj-label">{MOCK_PROBLEM.oj}</span>
        </div>
        <div className="problem-meta">
          <span>Time: {MOCK_PROBLEM.timeLimit}</span>
          <span>Memory: {MOCK_PROBLEM.memoryLimit}</span>
        </div>
        <div className="problem-section">
          <p>{MOCK_PROBLEM.statement}</p>
        </div>
        <div className="problem-section">
          <h4>Input</h4>
          <p>{MOCK_PROBLEM.inputSpec}</p>
        </div>
        <div className="problem-section">
          <h4>Output</h4>
          <p>{MOCK_PROBLEM.outputSpec}</p>
        </div>
        <div className="problem-section">
          <h4>Sample Input</h4>
          <pre className="sample-block">{MOCK_PROBLEM.sampleInput}</pre>
        </div>
        <div className="problem-section">
          <h4>Sample Output</h4>
          <pre className="sample-block">{MOCK_PROBLEM.sampleOutput}</pre>
        </div>
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
