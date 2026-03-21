import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProblemsPage from './pages/ProblemsPage'
import ProblemPage from './pages/ProblemPage'
import DashboardPage from './pages/DashboardPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import './App.css'

export default function App() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/auth/cf'

  return (
    <div className="app">
      {!isAuthPage && <Navbar />}
      <main className={isAuthPage ? '' : 'main'}>
        <Routes>
          <Route path="/" element={<ProblemsPage />} />
          <Route path="/problem/:oj/:contestId/:index" element={<ProblemPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/auth/cf" element={<AuthCallbackPage />} />
        </Routes>
      </main>
    </div>
  )
}
