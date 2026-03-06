import { useState } from 'react'

export default function PasswordPrompt({ slug, onVerify }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await onVerify(password)
    if (!ok) {
      setError('senha incorreta')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-terminal text-2xl font-bold mb-3 tracking-wider">[LOCKED]</div>
          <p className="text-shade text-xs">
            nota <span className="text-bone">/{slug}</span> protegida por senha
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-abyss border border-glyph rounded-sm p-5">
          <label className="block text-xs text-shade mb-2">$ senha:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder="digite a senha"
            className="w-full bg-void border border-glyph rounded-sm px-3 py-2.5 text-sm text-bone caret-terminal outline-none focus:border-terminal focus:shadow-terminal-sm transition-all"
            autoFocus
          />
          {error && <p className="text-blood text-xs mt-2">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full mt-4 py-2.5 bg-terminal hover:bg-terminal-dim text-void font-bold text-sm transition disabled:opacity-50"
          >
            {loading ? 'verificando...' : 'acessar nota'}
          </button>
        </form>

        <div className="text-center mt-4">
          <a href="/" className="text-terminal text-xs hover:underline">
            &gt; cd /
          </a>
        </div>
      </div>
    </div>
  )
}
