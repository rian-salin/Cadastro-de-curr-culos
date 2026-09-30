import { Link, Navigate, Route, Routes } from 'react-router'
import CandidateListPage from './pages/CandidateListPage'
import NewCandidatePage from './pages/NewCandidatePage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <>
      <header>
        <h1>Cadastro de Currículos</h1>
        <nav>
          <Link to="/candidates">Candidatos</Link>
          <Link to="/candidates/new">Novo cadastro</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/candidates" replace />} />
          <Route path="/candidates" element={<CandidateListPage />} />
          <Route path="/candidates/new" element={<NewCandidatePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </>
  )
}

export default App
