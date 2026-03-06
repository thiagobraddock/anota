import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function NoteMenu({ slug, isOwner, canEdit, accessMode, noteContent, onDelete, onRename, onToggleAccessMode, refetch }) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const ref = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSetPassword() {
    setLoading(true)
    try {
      await api.setPassword(slug, input || null)
      setModal(null)
      setInput('')
      refetch()
    } catch (err) {
      setError(err.error || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function handleRename() {
    if (!input.trim()) return
    setLoading(true)
    try {
      setModal(null)
      setInput('')
      onRename(input.trim().toLowerCase())
    } catch (err) {
      setError(err.error || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      setModal(null)
      onDelete()
    } catch (err) {
      setError(err.error || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function handleDuplicate() {
    if (!input.trim()) return
    setLoading(true)
    try {
      await api.saveNote(input.trim().toLowerCase(), noteContent)
      setModal(null)
      setInput('')
      navigate(`/${input.trim().toLowerCase()}`)
    } catch (err) {
      setError(err.error || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleAccess() {
    setOpen(false)
    await onToggleAccessMode()
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-sm text-shade hover:text-skull hover:bg-crypt transition"
          title="Menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 bg-abyss border border-glyph rounded-sm shadow-xl py-1 z-20 min-w-[200px]">
            {isOwner && (
              <button
                onClick={handleToggleAccess}
                className="w-full text-left px-3 py-2 text-sm text-bone hover:bg-crypt hover:text-skull transition flex items-center gap-2"
              >
                {accessMode === 'open' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                    tornar privada
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    tornar aberta
                  </>
                )}
              </button>
            )}

            {isOwner && <div className="h-px bg-glyph my-1" />}

            {isOwner && (
              <>
                <button
                  onClick={() => { setOpen(false); setModal('password'); setInput(''); setError('') }}
                  className="w-full text-left px-3 py-2 text-sm text-bone hover:bg-crypt hover:text-skull transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  definir senha
                </button>
                <button
                  onClick={() => { setOpen(false); setModal('rename'); setInput(''); setError('') }}
                  className="w-full text-left px-3 py-2 text-sm text-bone hover:bg-crypt hover:text-skull transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  renomear
                </button>
                <div className="h-px bg-glyph my-1" />
                <button
                  onClick={() => { setOpen(false); setModal('delete'); setError('') }}
                  className="w-full text-left px-3 py-2 text-sm text-blood hover:bg-crypt transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  excluir nota
                </button>
              </>
            )}

            {!isOwner && (
              <button
                onClick={() => { setOpen(false); setModal('duplicate'); setInput(''); setError('') }}
                className="w-full text-left px-3 py-2 text-sm text-bone hover:bg-crypt hover:text-skull transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                duplicar nota
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal overlay */}
      {modal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => setModal(null)}>
          <div className="bg-abyss border border-glyph rounded-sm p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {modal === 'password' && (
              <>
                <h3 className="text-skull font-bold text-sm tracking-wider mb-3">
                  <span className="text-terminal mr-1">&gt;</span> DEFINIR SENHA
                </h3>
                <p className="text-xs text-shade mb-4">
                  quem acessar essa nota precisara digitar a senha. deixe vazio para remover.
                </p>
                <input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="senha (vazio para remover)"
                  className="w-full bg-void border border-glyph rounded-sm px-3 py-2 text-sm text-bone caret-terminal outline-none focus:border-terminal focus:shadow-terminal-sm transition-all"
                  autoFocus
                />
                {error && <p className="text-blood text-xs mt-2">{error}</p>}
                <div className="flex gap-2 justify-end mt-4">
                  <button onClick={() => setModal(null)} className="px-4 py-2 text-xs text-shade hover:text-skull border border-glyph hover:border-shade transition">cancelar</button>
                  <button onClick={handleSetPassword} disabled={loading} className="px-4 py-2 text-xs bg-terminal text-void font-bold hover:bg-terminal-dim disabled:opacity-50 transition">
                    {loading ? '...' : 'salvar'}
                  </button>
                </div>
              </>
            )}

            {modal === 'rename' && (
              <>
                <h3 className="text-skull font-bold text-sm tracking-wider mb-3">
                  <span className="text-terminal mr-1">&gt;</span> RENOMEAR NOTA
                </h3>
                <p className="text-xs text-shade mb-4">
                  atual: <span className="text-bone">{slug}</span>
                </p>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => { setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setError('') }}
                  placeholder="novo-endereco"
                  className="w-full bg-void border border-glyph rounded-sm px-3 py-2 text-sm text-bone caret-terminal outline-none focus:border-terminal focus:shadow-terminal-sm transition-all"
                  maxLength={64}
                  autoFocus
                />
                {error && <p className="text-blood text-xs mt-2">{error}</p>}
                <div className="flex gap-2 justify-end mt-4">
                  <button onClick={() => setModal(null)} className="px-4 py-2 text-xs text-shade hover:text-skull border border-glyph hover:border-shade transition">cancelar</button>
                  <button onClick={handleRename} disabled={loading || !input.trim()} className="px-4 py-2 text-xs bg-terminal text-void font-bold hover:bg-terminal-dim disabled:opacity-50 transition">
                    {loading ? '...' : 'renomear'}
                  </button>
                </div>
              </>
            )}

            {modal === 'delete' && (
              <>
                <h3 className="text-skull font-bold text-sm tracking-wider mb-3">
                  <span className="text-blood mr-1">&gt;</span> EXCLUIR NOTA
                </h3>
                <p className="text-xs text-shade mb-4">
                  tem certeza? essa acao nao pode ser desfeita. a nota <span className="text-bone">{slug}</span> sera excluida permanentemente.
                </p>
                {error && <p className="text-blood text-xs mb-3">{error}</p>}
                <div className="flex gap-2 justify-end mt-4">
                  <button onClick={() => setModal(null)} className="px-4 py-2 text-xs text-shade hover:text-skull border border-glyph hover:border-shade transition">cancelar</button>
                  <button onClick={handleDelete} disabled={loading} className="px-4 py-2 text-xs bg-blood text-white font-bold hover:bg-blood-dim disabled:opacity-50 transition">
                    {loading ? '...' : 'excluir'}
                  </button>
                </div>
              </>
            )}

            {modal === 'duplicate' && (
              <>
                <h3 className="text-skull font-bold text-sm tracking-wider mb-3">
                  <span className="text-terminal mr-1">&gt;</span> DUPLICAR NOTA
                </h3>
                <p className="text-xs text-shade mb-4">
                  crie uma copia desta nota com um novo endereco. voce sera o dono da copia.
                </p>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => { setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setError('') }}
                  placeholder="novo-endereco"
                  className="w-full bg-void border border-glyph rounded-sm px-3 py-2 text-sm text-bone caret-terminal outline-none focus:border-terminal focus:shadow-terminal-sm transition-all"
                  maxLength={64}
                  autoFocus
                />
                {error && <p className="text-blood text-xs mt-2">{error}</p>}
                <div className="flex gap-2 justify-end mt-4">
                  <button onClick={() => setModal(null)} className="px-4 py-2 text-xs text-shade hover:text-skull border border-glyph hover:border-shade transition">cancelar</button>
                  <button onClick={handleDuplicate} disabled={loading || !input.trim()} className="px-4 py-2 text-xs bg-terminal text-void font-bold hover:bg-terminal-dim disabled:opacity-50 transition">
                    {loading ? '...' : 'duplicar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
