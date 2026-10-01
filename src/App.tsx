import { Suspense, lazy, useEffect, useState } from 'react'
import Home from './Home'

// the chat carries the whole Q&A bank, so it loads on demand
const Chat = lazy(() => import('./Chat'))

export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const on = () => setPath(window.location.pathname)
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  return path.startsWith('/chat') ? (
    <Suspense fallback={null}>
      <Chat key={window.location.search} />
    </Suspense>
  ) : (
    <Home />
  )
}
