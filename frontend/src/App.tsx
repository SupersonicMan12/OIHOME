import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProblemsPage from './pages/ProblemsPage'
import ProblemPage from './pages/ProblemPage'
import DashboardPage from './pages/DashboardPage'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<ProblemsPage />} />
          <Route path="/problem/:oj/:contestId/:index" element={<ProblemPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </main>
    </div>
  )
}
