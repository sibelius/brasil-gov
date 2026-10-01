import { navigate } from '../../routes/navigation'

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href="/"
      className="logo"
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
        navigate('/')
      }}
    >
      <img src="/brazil-flag.svg" width={34} height={24} alt="" className="flag" />
      <span>Brasil.gov</span>
    </a>
  )
}
