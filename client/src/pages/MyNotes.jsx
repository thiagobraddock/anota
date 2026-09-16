import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'

export default function MyNotes() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/')
      return
    }

    api.listMyNotes()
      .then(setNotes)
      .catch((err) => setError(err.error || 'Erro ao carregar notas'))
  }, [user, authLoading, navigate])

  return (
    <div className="min-h-screen bg-void px-6 py-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-skull">minhas notas</h1>
          <Link to="/" className="text-xs text-shade hover:text-bone transition">
            &lt; voltar
          </Link>
        </div>

        {error && <p className="text-blood text-xs">{error}</p>}

        {!error && notes === null && (
          <p className="text-shade text-xs">carregando...</p>
        )}

        {notes?.length === 0 && (
          <p className="text-shade text-xs">
            nenhuma nota vinculada a essa conta ainda.
          </p>
        )}

        {notes?.length > 0 && (
          <ul className="border border-glyph rounded-sm divide-y divide-glyph">
            {notes.map((note) => (
              <li key={note.slug}>
                <Link
                  to={`/${note.slug}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-abyss transition"
                >
                  <span className="text-terminal text-sm">/{note.slug}</span>
                  <span className="text-shade text-[10px] uppercase">
                    {note.access_mode === 'open' ? 'aberta' : 'privada'}
                    {note.has_password ? ' · com senha' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
