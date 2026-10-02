import { Suspense, lazy, useSyncExternalStore } from 'react'
import HomePage from '../pages/home-page'

const ChatPage = lazy(() => import('../pages/chat-page'))
const LocalModelPage = lazy(() => import('../pages/local-model-page'))
const McpPage = lazy(() => import('../pages/mcp-page'))

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)

  return () => window.removeEventListener('popstate', onChange)
}

function locationSnapshot() {
  return window.location.pathname + window.location.search
}

export default function AppRouter() {
  const location = useSyncExternalStore(subscribe, locationSnapshot)
  const pathname = location.split('?')[0]
  const isModelPage = pathname === '/local-model' || pathname === '/local-model/'
  const isMcpPage = pathname === '/mcp' || pathname === '/mcp/'

  if (!isModelPage && !isMcpPage && pathname !== '/chat' && pathname !== '/chat/') {
    return <HomePage />
  }

  return (
    <Suspense
      fallback={
        <p className="search-status" role="status">
          Carregando…
        </p>
      }
    >
      {isModelPage ? <LocalModelPage /> : isMcpPage ? <McpPage /> : <ChatPage key={location} />}
    </Suspense>
  )
}
