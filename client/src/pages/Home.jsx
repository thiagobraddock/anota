import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from '../components/ThemeToggle'

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/

function useTypewriter(text, speed = 45, delay = 0) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    indexRef.current = 0

    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        indexRef.current++
        if (indexRef.current <= text.length) {
          setDisplayed(text.slice(0, indexRef.current))
        } else {
          setDone(true)
          clearInterval(interval)
        }
      }, speed)
      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(startTimeout)
  }, [text, speed, delay])

  return { displayed, done }
}

export default function Home() {
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { user, login, logout } = useAuth()

  const init = useTypewriter('> initializing anota.it...', 40, 200)
  const slogan = useTypewriter('escreva. salve. compartilhe.', 50, 1400)

  function handleSubmit(e) {
    e.preventDefault()
    const normalized = slug.toLowerCase().trim()

    if (normalized.length < 2) {
      setError('minimo 2 caracteres')
      return
    }
    if (normalized.includes('--')) {
      setError('nao pode ter dois hifens seguidos')
      return
    }
    if (!SLUG_REGEX.test(normalized)) {
      setError('apenas letras, numeros e hifens. nao pode comecar ou terminar com hifen.')
      return
    }

    navigate(`/${normalized}`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-void">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-terminal">anota</span><span className="text-bone">.it</span>
        </h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-3">
              <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full ring-1 ring-glyph" />
              <span className="text-xs text-shade hidden sm:block">{user.name}</span>
              <button onClick={logout} className="text-xs text-shade hover:text-bone transition">
                sair
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="text-xs px-3 py-1.5 border border-glyph text-shade hover:text-skull hover:border-terminal transition"
            >
              entrar com google
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pt-[18vh]">
        <div className="w-full max-w-xl">
          <div className="mb-6">
            <p className="text-shade text-xs mb-2 h-5">
              {init.displayed}
              {!init.done && <span className="inline-block w-[2px] h-3.5 bg-terminal ml-0.5 align-middle animate-cursor-blink" />}
            </p>
            <h2 className="text-xl text-skull font-bold tracking-tight leading-tight h-8">
              {slogan.displayed}
              {init.done && !slogan.done && <span className="inline-block w-[2px] h-5 bg-terminal ml-0.5 align-middle animate-cursor-blink" />}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="bg-abyss border border-glyph rounded-sm p-5">
            <label className="block text-xs text-shade mb-3">
              escolha um endereco para sua nota:
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center flex-1 bg-void border border-glyph rounded-sm overflow-hidden focus-within:border-terminal focus-within:shadow-terminal-sm transition-all">
                <span className="text-terminal pl-3 shrink-0 text-sm">$</span>
                <span className="text-shade text-xs pl-1 shrink-0">
                  {window.location.host}/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setError('')
                  }}
                  placeholder="minha-nota"
                  className="flex-1 bg-transparent px-2 py-2.5 text-terminal outline-none text-sm placeholder:text-shade/40"
                  maxLength={64}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-terminal hover:bg-terminal-dim text-void font-bold text-sm rounded-sm transition shrink-0"
              >
                criar
              </button>
            </div>
            {error && <p className="text-blood text-xs mt-2">{error}</p>}
          </form>

          <div className="mt-8 text-xs text-shade space-y-1.5">
            <p className="text-terminal/50">// como funciona</p>
            <p>1. escolha um endereco para sua nota</p>
            <p>2. comece a escrever. auto-save ativado.</p>
            <p>3. modo aberto = qualquer um com o link edita</p>
            <p>4. modo privado = so voce edita</p>
            <p>5. suas notas nao expiram</p>
            <p>6. login com google = notas permanentes entre dispositivos</p>
          </div>
        </div>
      </main>
    </div>
  )
}
