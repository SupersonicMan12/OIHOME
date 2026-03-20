import './DashboardPage.css'

const STATS = [
  { label: 'Problems Solved', value: 0 },
  { label: 'Submissions', value: 0 },
  { label: 'OJs Connected', value: 0 },
]

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>
      <div className="stats-grid">
        {STATS.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="empty-state">
        <p>Connect your OJ accounts to start tracking progress.</p>
        <p className="muted">Codeforces · Luogu · AtCoder · UVA — coming soon</p>
      </div>
    </div>
  )
}
