import { useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

export default function TotpAuthModal({ onClose }) {
  const { setUser } = useAuth()
  const [step, setStep] = useState('email') // email | setup | code
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [qr, setQr] = useState(null)
  const [secret, setSecret] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { enabled } = await api.totpStart(email.trim().toLowerCase())
      setEmail(email.trim().toLowerCase())
      setStep(enabled ? 'code' : 'name')
    } catch (err) {
      setError(err.error || 'Erro ao verificar e-mail')
    } finally {
      setBusy(false)
    }
  }

  async function handleNameSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await api.totpSetup(email, name.trim())
      setQr(data.qr)
      setSecret(data.secret)
      setStep('setup')
    } catch (err) {
      setError(err.error || 'Erro ao configurar codigo')
    } finally {
      setBusy(false)
    }
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = step === 'setup'
        ? await api.totpConfirm(email, code.trim())
        : await api.totpLogin(email, code.trim())
      setUser(user)
      onClose()
    } catch (err) {
      setError(err.error || 'Codigo incorreto')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-abyss border border-glyph rounded-sm p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-terminal font-bold">entrar com codigo</h3>
          <button onClick={onClose} className="text-shade hover:text-bone text-xs">
            fechar
          </button>
        </div>

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <p className="text-xs text-shade">
              digite seu e-mail. se for a primeira vez, voce vai configurar um
              codigo no seu app autenticador (ex: Senhas do iPhone).
            </p>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full bg-void border border-glyph rounded-sm px-3 py-2 text-sm text-bone outline-none focus:border-terminal"
            />
            {error && <p className="text-blood text-xs">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 bg-terminal hover:bg-terminal-dim text-void font-bold text-sm rounded-sm transition disabled:opacity-50"
            >
              continuar
            </button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-3">
            <p className="text-xs text-shade">
              primeiro acesso com {email}. como podemos te chamar?
            </p>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="seu nome"
              className="w-full bg-void border border-glyph rounded-sm px-3 py-2 text-sm text-bone outline-none focus:border-terminal"
            />
            {error && <p className="text-blood text-xs">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 bg-terminal hover:bg-terminal-dim text-void font-bold text-sm rounded-sm transition disabled:opacity-50"
            >
              gerar codigo QR
            </button>
          </form>
        )}

        {step === 'setup' && (
          <form onSubmit={handleCodeSubmit} className="space-y-3">
            <p className="text-xs text-shade">
              escaneie o QR com o app Senhas (ou Google Authenticator) e
              digite o codigo de 6 digitos que ele mostrar.
            </p>
            <img src={qr} alt="QR code" className="mx-auto w-40 h-40 bg-white p-2 rounded-sm" />
            <p className="text-[10px] text-shade break-all text-center">
              chave manual: {secret}
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-void border border-glyph rounded-sm px-3 py-2 text-sm text-bone outline-none focus:border-terminal tracking-widest text-center"
            />
            {error && <p className="text-blood text-xs">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 bg-terminal hover:bg-terminal-dim text-void font-bold text-sm rounded-sm transition disabled:opacity-50"
            >
              confirmar e entrar
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-3">
            <p className="text-xs text-shade">
              digite o codigo de 6 digitos do seu app autenticador para {email}.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-void border border-glyph rounded-sm px-3 py-2 text-sm text-bone outline-none focus:border-terminal tracking-widest text-center"
            />
            {error && <p className="text-blood text-xs">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 bg-terminal hover:bg-terminal-dim text-void font-bold text-sm rounded-sm transition disabled:opacity-50"
            >
              entrar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
