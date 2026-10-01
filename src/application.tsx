import { StrictMode } from 'react'
import { AppErrorBoundary } from './components/app-error-boundary'
import AppRouter from './routes/app-router'

export default function App() {
  return (
    <StrictMode>
      <AppErrorBoundary>
        <AppRouter />
      </AppErrorBoundary>
    </StrictMode>
  )
}
