import { Suspense, lazy, useSyncExternalStore } from 'react'
import HomePage from '../pages/home-page'

const ChatPage = lazy(() => import('../pages/chat-page'))

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

  if (pathname !== '/chat' && pathname !== '/chat/') {
    return <HomePage />
  }

  return (
    <Suspense
      fallback={
        <p className="search-status" role="status">
          Carregando serviços…
        </p>
      }
    >
      <ChatPage key={location} />
    </Suspense>
  )
}
