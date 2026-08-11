import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { AgendaContactosPanel } from '../components/AgendaContactosPanel'

export function ContactosPage() {
  const navigate = useNavigate()

  function handleSelectContacto(cbu: string) {
    navigate('/transferir', { state: { cbu } })
  }

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-6">Contactos</h1>
        <AgendaContactosPanel onSelectContacto={handleSelectContacto} />
      </div>
    </PageWrapper>
  )
}
