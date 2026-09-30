import { Link } from 'react-router'

function NotFoundPage() {
  return (
    <section>
      <h2>Página não encontrada</h2>
      <p>
        <Link to="/candidates">Voltar para a listagem</Link>
      </p>
    </section>
  )
}

export default NotFoundPage
