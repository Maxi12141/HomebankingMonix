import { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { entrarModoPrueba } from '../lib/modoPrueba'

/** Entra al homebanking sin cuenta: bono, tour y datos de muestra. */
export function PruebaEntrada() {
  const navigate = useNavigate()

  useLayoutEffect(() => {
    entrarModoPrueba({ reiniciarTour: true })
    navigate('/dashboard', { replace: true })
  }, [navigate])

  return null
}
