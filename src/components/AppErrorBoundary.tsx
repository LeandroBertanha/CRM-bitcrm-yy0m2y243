import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[bitCRM] Falha inesperada na interface', error, info)
  }

  private retry = () => {
    this.setState({ hasError: false })
  }

  private reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="min-h-screen bg-[#0A0B0E] px-6 text-[#F5F6F8] flex items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-[#2C3140] bg-[#12141A] p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase text-indigo-300">bitCRM</p>
          <h1 className="mt-2 text-xl font-bold">Não foi possível exibir esta tela</h1>
          <p className="mt-2 text-sm text-gray-400">
            Sua sessão e seus dados permanecem protegidos. Tente abrir a tela novamente ou
            recarregue o sistema.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={this.retry}
              className="min-h-10 flex-1 rounded-lg border border-[#353B4A] px-4 text-sm font-semibold hover:bg-[#1A1E28]"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="min-h-10 flex-1 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Recarregar sistema
            </button>
          </div>
        </section>
      </main>
    )
  }
}
