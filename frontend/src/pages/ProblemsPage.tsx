import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './ProblemsPage.css'

const OJS = ['All', 'Codeforces', 'Luogu', 'AtCoder', 'UVA']
const LIMIT = 50

interface Problem {
  id: string
  contestId: number
  index: string
  oj: string
  ojLabel: string
  title: string
  difficulty: number | null
  tags: string[]
  solvedCount: number
  url: string
}

export default function ProblemsPage() {
  const [ojFilter, setOjFilter] = useState('Codeforces')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [problems, setProblems] = useState<Problem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const fetchProblems = useCallback(async () => {
    if (ojFilter === 'All' || ojFilter !== 'Codeforces') {
      setProblems([])
      setTotal(0)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        oj: ojFilter.toLowerCase(),
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
      })
      const res = await fetch(`/api/problems?${params}`)
      const data = await res.json()
      setProblems(data.problems)
      setTotal(data.total)
    } catch {
      setError('Failed to load problems')
    } finally {
      setLoading(false)
    }
  }, [ojFilter, page, search])

  useEffect(() => {
    fetchProblems()
  }, [fetchProblems])

  // reset page on filter/search change
  useEffect(() => { setPage(1) }, [ojFilter, search])

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="problems-page">
      <h1>Problems</h1>
      <div className="filters">
        <div className="search-row">
          <input
            className="search-input"
            placeholder="Search problems..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
          />
          <button className="search-btn" onClick={() => setSearch(searchInput)}>Search</button>
        </div>
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

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">Loading problems...</div>
      ) : (
        <>
          <div className="table-meta">{total > 0 && `${total.toLocaleString()} problems`}</div>
          <table className="problems-table">
            <thead>
              <tr>
                <th>OJ</th>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Solved</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {problems.map(p => (
                <tr
                  key={`${p.oj}-${p.id}`}
                  onClick={() => navigate(`/problem/${p.oj}/${p.contestId}/${p.index}`)}
                  className="problem-row"
                >
                  <td><span className={`oj-badge oj-${p.oj}`}>{p.ojLabel}</span></td>
                  <td className="problem-title">{p.title}</td>
                  <td className="difficulty">
                    {p.difficulty
                      ? <span className={`rating r${Math.floor(p.difficulty / 500) * 500}`}>{p.difficulty}</span>
                      : '—'}
                  </td>
                  <td className="solved-count">{p.solvedCount.toLocaleString()}</td>
                  <td>{p.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span>Page {page} of {totalPages.toLocaleString()}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
