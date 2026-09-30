import { useNavigate } from 'react-router'
import CandidateForm from '../components/CandidateForm'

function NewCandidatePage() {
  const navigate = useNavigate()

  return (
    <section>
      <h2>Novo cadastro</h2>
      <CandidateForm
        onSaved={(candidate) => {
          void navigate('/candidates', { state: { savedCandidateName: candidate.fullName } })
        }}
      />
    </section>
  )
}

export default NewCandidatePage
