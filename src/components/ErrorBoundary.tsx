import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de la aplicación:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-navy text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p className="font-display text-3xl font-bold tracking-tight mb-2">Monix</p>
          <h1 className="text-xl font-semibold mb-3">Algo salió mal</h1>
          <p className="text-white/70 text-sm leading-relaxed mb-6">
            Se produjo un error inesperado. Podés reintentar; si el problema sigue,
            cerrá la app y volvé a entrar.
          </p>
          <button
            type="button"
            className="rounded-xl bg-mint text-navy font-medium px-5 py-3 hover:bg-mint-hover transition-colors"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }
}
