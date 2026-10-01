import { Component, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error" role="alert">
          <h1>Não foi possível abrir esta página</h1>
          <p>Verifique sua conexão e recarregue para tentar novamente.</p>
          <button className="retry-button" onClick={() => window.location.reload()}>
            <RotateCw size={16} aria-hidden="true" />
            Recarregar
          </button>
        </main>
      )
    }

    return this.props.children
  }
}
