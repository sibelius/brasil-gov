export const navigate = (to: string) => {
  const target = new URL(to, window.location.href)
  const section =
    target.pathname === window.location.pathname
      ? document.getElementById(target.hash.slice(1))
      : null

  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))

  if (section) {
    section.scrollIntoView()
  } else {
    window.scrollTo(0, 0)
  }
}
