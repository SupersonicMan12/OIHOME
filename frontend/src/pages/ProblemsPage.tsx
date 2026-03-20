import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ProblemsPage.css'

const OJS = ['All', 'Codeforces', 'Luogu', 'AtCoder', 'UVA']

const MOCK_PROBLEMS = [
  { id: '1', oj: 'codeforces', ojLabel: 'Codeforces', title: 'Watermelon', difficulty: 800, tags: ['math', 'brute force'] },
  { id: '2', oj: 'codeforces', ojLabel: 'Codeforces', title: 'Boy or Girl', difficulty: 900, tags: ['strings'] },
  { id: '3', oj: 'atcoder', ojLabel: 'AtCoder', title: 'ABC - Product', difficulty: 100, tags: ['math'] },
  { id: '4', oj: 'luogu', ojLabel: 'Luogu', title: 'A+B Problem', difficulty: 0, tags: ['intro'] },
  { id: '5', oj: 'codeforces', ojLabel: 'Codeforces', title: 'Domino Piling', difficulty: 1200, tags: ['greedy', 'math'] },
  { id: '6', oj: 'uva', ojLabel: 'UVA', title: 'The 3n + 1 problem', difficulty: 0, tags: ['simulation'] },
]

export default function ProblemsPage() {
  const [ojFilter, setOjFilter] = useState('All')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = MOCK_PROBLEMS.filter(p => {
    const ojMatch = ojFilter === 'All' || p.ojLabel === ojFilter
    const searchMatch = p.title.toLowerCase().includes(search.toLowerCase())
    return ojMatch && searchMatch
  })

  return (
    <div className="problems-page">
      <h1>Problems</h1>
      <div className="filters">
        <input
          className="search-input"
          placeholder="Search problems..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="oj-tabs">
          {OJS.map(oj => (
            <button
              key={oj}
              className={`oj-tab ${ojFilter === oj ? 'active' : ''}`}
              onClick={() => setOjFilter(oj)}
            >
              {oj}
            </button>
          ))}
        </div>
      </div>

      <table className="problems-table">
        <thead>
          <tr>
            <th>OJ</th>
            <th>Title</th>
            <th>Difficulty</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={`${p.oj}-${p.id}`} onClick={() => navigate(`/problem/${p.oj}/${p.id}`)} className="problem-row">
              <td><span className={`oj-badge oj-${p.oj}`}>{p.ojLabel}</span></td>
              <td className="problem-title">{p.title}</td>
              <td className="difficulty">{p.difficulty || '—'}</td>
              <td>{p.tags.map(t => <span key={t} className="tag">{t}</span>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
